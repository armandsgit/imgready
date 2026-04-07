import io
import os
import shutil
import time

try:
    import psutil
except Exception:  # pragma: no cover - fallback when psutil is unavailable
    psutil = None

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from PIL import Image

from ai.isnet_onnx import QUALITY_CONFIG as ISNET_QUALITY_CONFIG
from ai.isnet_onnx import process_image_bytes

try:
    from ai.birefnet_baseline import QUALITY_CONFIG as BIREFNET_QUALITY_CONFIG
    from ai.birefnet_baseline import process_image_bytes as process_with_birefnet
except Exception as birefnet_import_error:  # pragma: no cover - optional backend path
    BIREFNET_QUALITY_CONFIG = None
    process_with_birefnet = None
    _birefnet_import_error = birefnet_import_error
else:
    _birefnet_import_error = None


SERVER_STARTED_AT = time.time()
BIREFNET_ENABLED = os.getenv("ENABLE_BIREFNET", "").strip().lower() in {"1", "true", "yes", "on"}

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/admin/system-metrics")
async def admin_system_metrics():
    uptime_seconds = max(0.0, time.time() - SERVER_STARTED_AT)

    if psutil:
        cpu_percent = psutil.cpu_percent(interval=0.05)
        ram_percent = psutil.virtual_memory().percent
        disk_percent = psutil.disk_usage("/").percent
        active_processes = len(psutil.pids())
    else:
        cpu_count = os.cpu_count() or 1
        try:
            cpu_percent = min(100.0, (os.getloadavg()[0] / cpu_count) * 100)
        except OSError:
            cpu_percent = None
        ram_percent = None
        disk_percent = (shutil.disk_usage("/").used / shutil.disk_usage("/").total) * 100
        active_processes = None

    return JSONResponse(
        {
            "cpuPercent": round(cpu_percent, 1) if isinstance(cpu_percent, (int, float)) else None,
            "ramPercent": round(ram_percent, 1) if isinstance(ram_percent, (int, float)) else None,
            "diskPercent": round(disk_percent, 1) if isinstance(disk_percent, (int, float)) else None,
            "uptime": round(uptime_seconds),
            "activeProcesses": active_processes,
        }
    )


@app.post("/remove-bg")
async def remove_bg(
    file: UploadFile = File(...),
    mask_cleanup: str = Form("standard"),
    debug_export: bool = Form(False),
    model: str = Form("isnet"),
    quality: str = Form("standard"),
):
    del mask_cleanup, debug_export
    input_bytes = await file.read()
    selected_model = model.strip().lower()
    selected_quality = quality.strip().lower()

    try:
        if selected_model == "birefnet":
            if not BIREFNET_ENABLED:
                raise RuntimeError(
                    "BiRefNet is disabled in this environment. Use model=isnet or enable ENABLE_BIREFNET=true."
                )

            if process_with_birefnet is None or BIREFNET_QUALITY_CONFIG is None:
                raise RuntimeError(
                    "BiRefNet is unavailable in this environment. Use model=isnet or install optional BiRefNet dependencies."
                ) from _birefnet_import_error

            print(">>> remove-bg using model birefnet")
            cutout_bytes = process_with_birefnet(input_bytes, selected_quality)
            model_label = "birefnet"
            quality_config = BIREFNET_QUALITY_CONFIG
        else:
            print(">>> remove-bg using model isnet")
            cutout_bytes = process_image_bytes(input_bytes, selected_quality)
            model_label = "isnet-onnx"
            quality_config = ISNET_QUALITY_CONFIG

        with Image.open(io.BytesIO(input_bytes)) as original_image:
            original_width, original_height = original_image.size
        with Image.open(io.BytesIO(cutout_bytes)) as output_image:
            export_width, export_height = output_image.size

        source_max_side_value = quality_config.get(selected_quality, quality_config["standard"])["inference_max_side"]
        source_max_side = "original" if source_max_side_value is None else str(source_max_side_value)
        inference_input = "1024x1024"
        export_size_header = (
            "original" if selected_quality == "original" else f"{export_width}x{export_height}"
        )

        print("[PROCESS]")
        print(f"quality={selected_quality}")
        print(f"model={model_label}")
        print(f"original_size={original_width}x{original_height}")
        print(f"source_max_side={source_max_side}")
        print(f"inference_input={inference_input}")
        print(f"export_size={export_width}x{export_height}")
    except Exception as error:
        print(">>> remove-bg explicit error <<<")
        print(str(error))
        return Response(str(error), media_type="text/plain", status_code=500)

    return Response(
        cutout_bytes,
        media_type="image/png",
        headers={
            "X-Quality-Mode": selected_quality,
            "X-Export-Size": export_size_header,
            "X-Model-Used": "birefnet" if selected_model == "birefnet" else "isnet",
        },
    )

from __future__ import annotations

import io
import time
from pathlib import Path
from threading import Lock

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageCms, ImageOps


MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "isnet.onnx"
TARGET_SIZE = 1024
QUALITY_CONFIG = {
    "standard": {"inference_max_side": None, "export_size": 1200},
    "hd": {"inference_max_side": None, "export_size": 1600},
    "original": {"inference_max_side": None, "export_size": None},
}

SRGB_PROFILE = ImageCms.createProfile("sRGB")
SRGB_PROFILE_BYTES = ImageCms.ImageCmsProfile(SRGB_PROFILE).tobytes()

_session_lock = Lock()
_session: ort.InferenceSession | None = None


def log(message: str) -> None:
    print(f">>> IS-Net ONNX {message}")


def resolve_quality(quality: str) -> str:
    normalized = quality.strip().lower()
    return normalized if normalized in QUALITY_CONFIG else "standard"


def ensure_srgb_with_profile(image: Image.Image, icc_profile: bytes | None) -> Image.Image:
    normalized_image = ImageOps.exif_transpose(image)

    if not icc_profile:
        return normalized_image.convert("RGBA")

    try:
        input_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc_profile))
        return ImageCms.profileToProfile(normalized_image, input_profile, SRGB_PROFILE, outputMode="RGBA")
    except Exception:
        return normalized_image.convert("RGBA")


def get_session() -> ort.InferenceSession:
    global _session

    if _session is not None:
        return _session

    with _session_lock:
        if _session is not None:
            return _session

        if not MODEL_PATH.exists():
            raise RuntimeError(f"Missing ONNX model at {MODEL_PATH}")

        _session = ort.InferenceSession(MODEL_PATH.as_posix(), providers=["CPUExecutionProvider"])
        log("model loaded")
        return _session


def resize_with_letterbox(image: Image.Image) -> tuple[Image.Image, tuple[int, int], tuple[int, int]]:
    width, height = image.size
    scale = min(TARGET_SIZE / width, TARGET_SIZE / height)
    resized_width = max(1, int(round(width * scale)))
    resized_height = max(1, int(round(height * scale)))
    resized = image.resize((resized_width, resized_height), Image.Resampling.BICUBIC)

    canvas = Image.new("RGB", (TARGET_SIZE, TARGET_SIZE), (255, 255, 255))
    offset_x = (TARGET_SIZE - resized_width) // 2
    offset_y = (TARGET_SIZE - resized_height) // 2
    canvas.paste(resized, (offset_x, offset_y))
    return canvas, (offset_x, offset_y), (resized_width, resized_height)


def preprocess_image(image: Image.Image) -> tuple[np.ndarray, tuple[int, int], tuple[int, int]]:
    letterboxed, offset, resized_size = resize_with_letterbox(image.convert("RGB"))
    image_np = np.asarray(letterboxed, dtype=np.float32)
    image_np = (image_np - 128.0) / 256.0
    image_np = np.transpose(image_np, (2, 0, 1))[None, ...]
    return image_np, offset, resized_size


def predict_mask(image: Image.Image) -> Image.Image:
    session = get_session()
    input_tensor, (offset_x, offset_y), (resized_width, resized_height) = preprocess_image(image)

    start = time.perf_counter()
    outputs = session.run(None, {"input": input_tensor})
    elapsed = time.perf_counter() - start

    if not outputs:
        raise RuntimeError("IS-Net ONNX returned no outputs")

    mask = outputs[0][0, 0].astype(np.float32)
    log(f"input image size {image.size[0]}x{image.size[1]}")
    log(f"resized image size {resized_width}x{resized_height}")
    log(f"inference time {elapsed:.3f}s")
    log(f"mask shape {mask.shape}")

    mask_min = float(mask.min())
    mask_max = float(mask.max())
    log(f"mask range {mask_min:.6f}..{mask_max:.6f}")

    if mask_max > mask_min:
        mask = (mask - mask_min) / (mask_max - mask_min)
    else:
        mask = np.zeros_like(mask, dtype=np.float32)

    mask = np.clip(mask, 0.0, 1.0)
    mask_uint8 = np.round(mask * 255.0).astype(np.uint8)
    mask_image = Image.fromarray(mask_uint8, mode="L")

    mask_image = mask_image.crop((offset_x, offset_y, offset_x + resized_width, offset_y + resized_height))
    mask_image = mask_image.resize(image.size, Image.Resampling.BILINEAR)

    mask_np = np.asarray(mask_image, dtype=np.float32)

    mask_np = mask_np * 1.3
    mask_np = np.clip(mask_np, 0, 255)
    mask_np[mask_np < 18] = 0

    return Image.fromarray(mask_np.astype(np.uint8), mode="L")


def build_export(image: Image.Image, export_size: int | None) -> Image.Image:
    if export_size is None:
        return image

    rgba_image = image.convert("RGBA")
    canvas = Image.new("RGBA", (export_size, export_size), (0, 0, 0, 0))

    source_width, source_height = rgba_image.size
    scale = min(export_size / source_width, export_size / source_height)
    output_width = max(1, int(round(source_width * scale)))
    output_height = max(1, int(round(source_height * scale)))

    composed = rgba_image
    if (output_width, output_height) != rgba_image.size:
        composed = rgba_image.resize((output_width, output_height), Image.Resampling.LANCZOS)

    alpha_bbox = composed.getchannel("A").getbbox()
    if alpha_bbox is None:
        offset_x = (export_size - output_width) // 2
        offset_y = (export_size - output_height) // 2
    else:
        subject_center_x = (alpha_bbox[0] + alpha_bbox[2]) / 2
        subject_center_y = (alpha_bbox[1] + alpha_bbox[3]) / 2
        canvas_center = export_size / 2
        offset_x = int(round(canvas_center - subject_center_x))
        offset_y = int(round(canvas_center - subject_center_y))

    canvas.paste(composed, (offset_x, offset_y), composed)
    return canvas


def process_image_bytes(input_bytes: bytes, quality: str = "standard") -> bytes:
    selected_quality = resolve_quality(quality)
    export_size = QUALITY_CONFIG[selected_quality]["export_size"]

    with Image.open(io.BytesIO(input_bytes)) as original_image:
        icc_profile = original_image.info.get("icc_profile")
        rgba_image = ensure_srgb_with_profile(original_image, icc_profile)
        original_size = rgba_image.size

        log(f"selected quality {selected_quality}")
        log(f"inference source size original {original_size[0]}x{original_size[1]}")

        alpha_mask = predict_mask(rgba_image)
        cutout = rgba_image.copy()
        cutout.putalpha(alpha_mask)
        cutout = build_export(cutout, export_size)

        log(f"original input size {original_size[0]}x{original_size[1]}")
        if export_size is None:
            log(f"export size original {cutout.size[0]}x{cutout.size[1]}")
        else:
            log(f"export size {cutout.size[0]}x{cutout.size[1]}")

    output = io.BytesIO()
    cutout.save(output, format="PNG", icc_profile=SRGB_PROFILE_BYTES, compress_level=6)
    return output.getvalue()

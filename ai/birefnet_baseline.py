from __future__ import annotations

import io
import time
from pathlib import Path
from threading import Lock

import numpy as np
import torch
from PIL import Image, ImageCms, ImageOps
from transformers import AutoModelForImageSegmentation


MODEL_ID = "ZhengPeng7/BiRefNet-matting"
TARGET_SIZE = 1024
DEBUG_EXPORT_DIR = Path(__file__).resolve().parent / "debug_exports" / "latest-export"
QUALITY_CONFIG = {
    "standard": {"inference_max_side": 1024, "export_size": 1200},
    "hd": {"inference_max_side": None, "export_size": 1600},
    "original": {"inference_max_side": None, "export_size": None},
}

SRGB_PROFILE = ImageCms.createProfile("sRGB")
SRGB_PROFILE_BYTES = ImageCms.ImageCmsProfile(SRGB_PROFILE).tobytes()
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

_model_lock = Lock()
_model: AutoModelForImageSegmentation | None = None
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def log(message: str) -> None:
    print(f">>> BiRefNet refine {message}")


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


def downscale_for_quality(image: Image.Image, quality: str) -> Image.Image:
    max_dimension = QUALITY_CONFIG[resolve_quality(quality)]["inference_max_side"]
    if max_dimension is None:
        return image

    width, height = image.size
    longest_side = max(width, height)
    if longest_side <= max_dimension:
        return image

    scale = max_dimension / longest_side
    resized_size = (max(1, int(round(width * scale))), max(1, int(round(height * scale))))
    log(f"quality {quality} downscale {width}x{height} -> {resized_size[0]}x{resized_size[1]}")
    return image.resize(resized_size, Image.Resampling.LANCZOS)


def build_square_export(image: Image.Image, export_size: int | None) -> Image.Image:
    if export_size is None:
        return image

    rgba_image = image.convert("RGBA")
    canvas = Image.new("RGBA", (export_size, export_size), (0, 0, 0, 0))
    source_width, source_height = rgba_image.size
    log(f"export source size {source_width}x{source_height}")
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

    DEBUG_EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    rgba_image.getchannel("A").save(DEBUG_EXPORT_DIR / "raw-alpha-mask.png")
    composed.save(DEBUG_EXPORT_DIR / "cropped-object.png")
    canvas.save(DEBUG_EXPORT_DIR / "final-export.png")
    return canvas


def get_model() -> AutoModelForImageSegmentation:
    global _model

    if _model is not None:
        return _model

    with _model_lock:
        if _model is not None:
            return _model

        log(f"loading model {MODEL_ID} on {_device.type}")
        model = AutoModelForImageSegmentation.from_pretrained(
            MODEL_ID,
            trust_remote_code=True,
        )
        model.to(_device)
        model.eval()
        _model = model
        log("model loaded")
        return _model


def preprocess_image(image: Image.Image) -> torch.Tensor:
    rgb_image = image.convert("RGB")
    resized = rgb_image.resize((TARGET_SIZE, TARGET_SIZE), Image.Resampling.BICUBIC)
    image_np = np.asarray(resized, dtype=np.float32) / 255.0
    image_np = (image_np - IMAGENET_MEAN) / IMAGENET_STD
    image_np = np.transpose(image_np, (2, 0, 1))[None, ...]
    return torch.from_numpy(image_np).to(_device)


def predict_mask(image: Image.Image) -> Image.Image:
    model = get_model()
    input_tensor = preprocess_image(image)

    start = time.perf_counter()
    with torch.inference_mode():
        preds = model(input_tensor)[-1].sigmoid()
    elapsed = time.perf_counter() - start

    mask = preds[0].squeeze().detach().float().cpu().numpy()
    log(f"input image size {image.size[0]}x{image.size[1]}")
    log(f"inference size {TARGET_SIZE}x{TARGET_SIZE}")
    log(f"inference time {elapsed:.3f}s")
    log(f"mask shape {mask.shape}")

    mask = np.clip(mask, 0.0, 1.0)
    mask_uint8 = np.round(mask * 255.0).astype(np.uint8)
    mask_image = Image.fromarray(mask_uint8, mode="L")
    return mask_image.resize(image.size, Image.Resampling.BILINEAR)


def process_image_bytes(input_bytes: bytes, quality: str = "standard") -> bytes:
    selected_quality = resolve_quality(quality)

    with Image.open(io.BytesIO(input_bytes)) as original_image:
        icc_profile = original_image.info.get("icc_profile")
        rgba_image = ensure_srgb_with_profile(original_image, icc_profile)
        original_size = rgba_image.size
        rgba_image = downscale_for_quality(rgba_image, selected_quality)
        inference_source_size = rgba_image.size
        config = QUALITY_CONFIG[selected_quality]
        max_side = config["inference_max_side"]
        export_size = config["export_size"]

        log(f"selected quality {selected_quality}")
        if max_side is None:
            log(f"inference source size original {inference_source_size[0]}x{inference_source_size[1]}")
        else:
            log(f"inference source max side {max_side}")
            log(f"inference source size {inference_source_size[0]}x{inference_source_size[1]}")

        alpha_mask = predict_mask(rgba_image)
        cutout = rgba_image.copy()
        cutout.putalpha(alpha_mask)
        cutout = build_square_export(cutout, export_size)
        log(f"original input size {original_size[0]}x{original_size[1]}")
        if export_size is not None:
            log(f"export size {export_size}x{export_size}")
        else:
            log(f"export size original {cutout.size[0]}x{cutout.size[1]}")

    output = io.BytesIO()
    cutout.save(output, format="PNG", icc_profile=SRGB_PROFILE_BYTES, compress_level=6)
    return output.getvalue()

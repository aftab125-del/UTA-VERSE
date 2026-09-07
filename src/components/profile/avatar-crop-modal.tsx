"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Point, Area } from "react-easy-crop";
import { getCroppedImg } from "@/lib/utils/crop-image";

export interface AvatarCropModalProps {
  imageSrc: string;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => Promise<void> | void;
}

export function AvatarCropModal({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onAreaComplete = useCallback((_croppedArea: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 512);
      await onCropComplete(croppedBlob);
      onClose();
    } catch (err) {
      console.error("[AvatarCrop] Crop generation failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="crop-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
    >
      <div className="crop-modal">
        <div className="crop-modal__header">
          <div>
            <h3 id="crop-modal-title" className="crop-modal__title">
              Adjust Profile Photo
            </h3>
            <p className="crop-modal__subtitle">
              Drag to reposition and zoom to fit inside the circular frame.
            </p>
          </div>
          <button
            type="button"
            className="crop-modal__close"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="crop-modal__body">
          <div className="crop-container">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onAreaComplete}
            />
          </div>

          <div className="crop-controls">
            <span className="crop-controls__icon" aria-hidden="true">
              −
            </span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.05}
              aria-label="Zoom avatar"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="crop-zoom-slider"
            />
            <span className="crop-controls__icon" aria-hidden="true">
              +
            </span>
          </div>
        </div>

        <div className="crop-modal__footer">
          <button
            type="button"
            className="crop-btn-cancel"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            type="button"
            className="crop-btn-save"
            onClick={handleSave}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Save Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

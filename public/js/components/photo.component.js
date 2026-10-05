/**
 * Componente de Prévia, Seleção e Upload de Fotos do Pet
 */

import { $ } from "../utils/dom.js";

export class PhotoComponent {
  constructor({ state, onPhotoSelected, onPhotoCleared, onPhotoSubmitted, onPhotoSkipped }) {
    this.state = state;
    this.onPhotoSelected = onPhotoSelected;
    this.onPhotoCleared = onPhotoCleared;
    this.onPhotoSubmitted = onPhotoSubmitted;
    this.onPhotoSkipped = onPhotoSkipped;

    this.previewContainer = $("#imagePreviewContainer");
    this.previewImg = $("#imagePreviewImg");
    this.fileInput = $("#imageFileInput");
    this.attachBtn = $("#imageAttachBtn");
    this.removeBtn = $("#imagePreviewRemoveBtn");
    this.submitBtn = $("#imagePreviewSubmitBtn");

    this.initEvents();
  }

  initEvents() {
    if (this.attachBtn && this.fileInput) {
      this.attachBtn.addEventListener("click", () => this.fileInput.click());
    }

    if (this.fileInput) {
      this.fileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) this.handleFile(file);
      });
    }

    if (this.removeBtn) {
      this.removeBtn.addEventListener("click", () => this.clear());
    }

    if (this.submitBtn) {
      this.submitBtn.addEventListener("click", () => {
        if (this.onPhotoSubmitted) this.onPhotoSubmitted();
      });
    }

    // Exposição global para botões dentro do card no chat
    window.triggerPetPhotoUpload = () => {
      if (this.fileInput) this.fileInput.click();
    };

    window.skipPetPhotoUpload = () => {
      if (this.onPhotoSkipped) this.onPhotoSkipped();
    };
  }

  handleFile(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      this.state.selectedImageBase64 = dataUrl;
      this.state.selectedImageMime = file.type || "image/jpeg";
      this.state.userHasSentPhoto = true;
      this.state.photoRefused = false;
      this.state.photoRequested = false;

      this.showPreview(dataUrl);
      if (this.onPhotoSelected) this.onPhotoSelected(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  showPreview(dataUrl) {
    if (this.previewContainer && this.previewImg) {
      this.previewImg.src = dataUrl;
      this.previewContainer.classList.remove("hidden");
    }
    if (this.attachBtn) {
      this.attachBtn.classList.add("has-photo");
    }
  }

  clear() {
    this.state.selectedImageBase64 = null;
    this.state.selectedImageMime = "image/jpeg";

    if (this.previewContainer) this.previewContainer.classList.add("hidden");
    if (this.previewImg) this.previewImg.src = "";
    if (this.fileInput) this.fileInput.value = "";
    if (this.attachBtn) this.attachBtn.classList.remove("has-photo");

    if (this.onPhotoCleared) this.onPhotoCleared();
  }
}

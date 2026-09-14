export function renderModalAndToasts(): string {
  return `
  <!-- REUSABLE MODAL DIALOG -->
  <div id="modal-backdrop" class="modal-backdrop" style="display: none;">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 id="modal-title">Modal Title</h3>
        <button class="modal-close-btn" onclick="closeModal()">✕</button>
      </div>
      <div id="modal-body" class="modal-body"></div>
      <div id="modal-footer" class="modal-footer"></div>
    </div>
  </div>

  <!-- TOAST NOTIFICATION CONTAINER -->
  <div id="toast-container" class="toast-container"></div>
  `;
}

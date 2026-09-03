/**
 * Compresses and converts an image File object to a Base64 data URL string.
 * This stores the binary image cleanly inside Firestore and SQLite without external image hosts.
 *
 * @param {File} file - Browser File object
 * @param {number} maxWidth - Maximum width in pixels (default 1200)
 * @param {number} maxHeight - Maximum height in pixels (default 1200)
 * @param {number} quality - JPEG compression quality 0.0 - 1.0 (default 0.85)
 * @returns {Promise<string>} Base64 data URL
 */
export function fileToBase64(file, maxWidth = 1200, maxHeight = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to web-friendly JPEG data URL
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

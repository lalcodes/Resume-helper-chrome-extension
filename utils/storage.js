/**
 * Utility functions for interacting with chrome.storage.local.
 */

/**
 * Retrieves an item from chrome.storage.local.
 * @param {string} key - The key of the item to retrieve.
 * @param {*} defaultValue - The value to return if the key is not found.
 * @returns {Promise<*>} The stored value or defaultValue.
 */
export async function getStorageItem(key, defaultValue = null) {
  try {
    const result = await chrome.storage.local.get([key]);
    if (result && result[key] !== undefined) {
      return result[key];
    }
    return defaultValue;
  } catch (error) {
    console.error(`[Storage] Error reading key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Saves an item to chrome.storage.local.
 * @param {string} key - The key of the item to save.
 * @param {*} value - The value to save.
 * @returns {Promise<boolean>} True if saving was successful, false otherwise.
 */
export async function setStorageItem(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
    return true;
  } catch (error) {
    console.error(`[Storage] Error writing key "${key}":`, error);
    return false;
  }
}

/**
 * Removes an item from chrome.storage.local.
 * @param {string} key - The key of the item to remove.
 * @returns {Promise<boolean>} True if removal was successful, false otherwise.
 */
export async function removeStorageItem(key) {
  try {
    await chrome.storage.local.remove([key]);
    return true;
  } catch (error) {
    console.error(`[Storage] Error removing key "${key}":`, error);
    return false;
  }
}

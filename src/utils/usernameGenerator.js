/**
 * Generate a unique username from a name
 * @param {string} name - The user's name
 * @returns {string} - Generated username
 */
export function generateUsername(name) {
  // Clean the name: lowercase, remove non-alphanumeric, limit to 12 chars
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

  // Add random 4-digit number
  const random = Math.floor(1000 + Math.random() * 9000);

  return `${base}_${random}`;
}

/**
 * Generate a unique username by checking against database
 * @param {string} name - The user's name
 * @param {Object} User - Mongoose User model
 * @returns {string} - Unique username
 */
export async function generateUniqueUsername(name, User) {
  let username;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loops

  while (exists && attempts < maxAttempts) {
    username = generateUsername(name);
    exists = await User.exists({ username });
    attempts++;
  }

  if (attempts >= maxAttempts) {
    // Fallback: use timestamp-based username
    const timestamp = Date.now().toString().slice(-4);
    username = `${name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)}_${timestamp}`;
  }

  return username;
}
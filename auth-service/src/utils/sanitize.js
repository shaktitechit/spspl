function sanitizeUser(userDoc) {
  if (!userDoc) return null;
  const copy = { ...userDoc };
  delete copy.password;
  delete copy.__v;
  return copy;
}

module.exports = { sanitizeUser };

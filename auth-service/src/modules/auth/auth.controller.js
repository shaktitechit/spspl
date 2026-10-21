const authService = require('./auth.service');
const { validateLoginBody } = require('./auth.validation');
const {
  setAuthCookies,
  clearAuthCookies,
  readRefreshTokenFromRequest,
} = require('../../utils/authCookies');

function sendAuthPayload(res, result) {
  setAuthCookies(res, {
    token: result.token,
    refreshToken: result.refreshToken,
    refreshExpiresIn: result.refreshExpiresIn,
  });
  res.json({
    success: true,
    token: result.token,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    refreshExpiresIn: result.refreshExpiresIn,
    user: result.user,
    data: result,
  });
}

async function login(req, res, next) {
  try {
    const { email, password } = validateLoginBody(req.body);
    const result = await authService.login(email, password);
    sendAuthPayload(res, result);
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const rawToken = readRefreshTokenFromRequest(req);
    const result = await authService.refresh(rawToken);
    sendAuthPayload(res, result);
  } catch (err) {
    clearAuthCookies(res);
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const rawToken = readRefreshTokenFromRequest(req);
    const result = await authService.logout(rawToken);
    clearAuthCookies(res);
    res.json({ success: true, ...result });
  } catch (err) {
    clearAuthCookies(res);
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.me(req.user._id);
    res.json({ success: true, user, data: user });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const result = await authService.changePassword(
      req.user._id,
      req.body?.currentPassword,
      req.body?.newPassword,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createHandoff(req, res, next) {
  try {
    const result = await authService.createHandoff(req.user._id);
    res.json({
      success: true,
      code: result.code,
      expires_in: result.expires_in,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function exchangeHandoff(req, res, next) {
  try {
    const code = req.body?.code || req.body?.handoff;
    const result = await authService.exchangeHandoff(code);
    sendAuthPayload(res, result);
  } catch (err) {
    clearAuthCookies(res);
    next(err);
  }
}

module.exports = {
  login,
  refresh,
  logout,
  me,
  changePassword,
  createHandoff,
  exchangeHandoff,
};

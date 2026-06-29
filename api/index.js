const { initApp } = require("../app");

let appPromise;

module.exports = async (req, res) => {
  if (!appPromise) {
    appPromise = initApp();
  }

  const app = await appPromise;
  return app(req, res);
};

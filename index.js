const { initApp } = require("./app");

const port = process.env.PORT || 5000;

initApp()
  .then((app) => {
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });

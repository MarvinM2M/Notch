// WinNotch Web Connector - Main World Hook
(function () {
  try {
    const OriginalNotification = window.Notification;
    window.Notification = function (title, options) {
      window.postMessage({
        type: "WINNOTCH_NOTIFICATION",
        title: title || "",
        body: (options && options.body) ? options.body : ""
      }, "*");

      try {
        if (OriginalNotification) {
          return new OriginalNotification(title, options);
        }
      } catch (e) {
        return {};
      }
    };

    window.Notification.permission = "granted";
    window.Notification.requestPermission = function (cb) {
      if (cb) cb("granted");
      return Promise.resolve("granted");
    };

    if (OriginalNotification) {
      Object.assign(window.Notification, OriginalNotification);
    }
  } catch (err) {}
})();

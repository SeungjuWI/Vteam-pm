const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let tray;
let nextServer;
const PORT = 3000;
const isDev = process.env.NODE_ENV !== "production";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: "Vteam",
    titleBarStyle: "default",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("close", (e) => {
    if (process.platform === "darwin") {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "../public/icon.png")
  );
  const trayIcon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Vteam 열기",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "종료",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Vteam");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function startNextServer() {
  return new Promise((resolve) => {
    if (isDev) {
      // 개발 모드: Next.js dev 서버가 이미 실행 중이라고 가정
      resolve();
      return;
    }

    // 프로덕션: 빌드된 Next.js 서버 실행
    nextServer = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, NODE_ENV: "production" },
      stdio: "pipe",
    });

    nextServer.stdout.on("data", (data) => {
      const output = data.toString();
      console.log("[Next.js]", output);
      if (output.includes("Ready") || output.includes("started")) {
        resolve();
      }
    });

    nextServer.stderr.on("data", (data) => {
      console.error("[Next.js]", data.toString());
    });

    // 서버 시작 타임아웃 (10초 후 강제 진행)
    setTimeout(resolve, 10000);
  });
}

app.whenReady().then(async () => {
  await startNextServer();
  createWindow();
  createTray();

  app.on("activate", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (nextServer) {
    nextServer.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

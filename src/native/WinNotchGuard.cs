using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace WinNotchSecurity {
    static class Program {
        [DllImport("kernel32.dll", SetLastError = true, ExactSpelling = true)]
        static extern bool IsDebuggerPresent();

        [DllImport("kernel32.dll", SetLastError = true, ExactSpelling = true)]
        static extern bool CheckRemoteDebuggerPresent(IntPtr hProcess, ref bool isDebuggerPresent);

        static bool IsSecurityCompromised() {
            // 1. IsDebuggerPresent
            if (IsDebuggerPresent()) return true;

            // 2. CheckRemoteDebuggerPresent
            bool isRemoteDebugger = false;
            CheckRemoteDebuggerPresent(Process.GetCurrentProcess().Handle, ref isRemoteDebugger);
            if (isRemoteDebugger) return true;

            // 3. Blacklisted reverse engineering / tamper tools
            string[] blacklisted = {
                "x64dbg", "x32dbg", "ida64", "ida", "cheatengine",
                "ollydbg", "fiddler", "charles", "httpdebugger",
                "dnspy", "processhacker"
            };

            foreach (var p in Process.GetProcesses()) {
                try {
                    string name = p.ProcessName.ToLower();
                    foreach (var bad in blacklisted) {
                        if (name.Contains(bad)) return true;
                    }
                } catch {}
            }

            return false;
        }

        [STAThread]
        static void Main(string[] args) {
            // Anti-Tamper check before launch
            if (IsSecurityCompromised()) {
                MessageBox.Show(
                    "WinNotch Security Guard: Terdeteksi aktivitas debugger atau peralatan tidak sah.\nAplikasi dihentikan demi keamanan sistem.",
                    "WinNotch Anti-Tamper Security",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                Environment.Exit(1);
            }

            string appDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
            string electronDist = Path.Combine(appDir, "node_modules", "electron", "dist", "electron.exe");
            string extraArgs = (args != null && args.Length > 0) ? " " + string.Join(" ", args) : "";

            ProcessStartInfo psi;
            if (File.Exists(electronDist)) {
                psi = new ProcessStartInfo(electronDist, string.Format("\"{0}\"{1}", appDir, extraArgs));
            } else {
                psi = new ProcessStartInfo("cmd.exe", "/c npm start");
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;
            }

            psi.WorkingDirectory = appDir;
            psi.UseShellExecute = false;

            try {
                using (Process proc = Process.Start(psi)) {
                    // Continuous tamper protection
                    while (!proc.WaitForExit(3000)) {
                        if (IsSecurityCompromised()) {
                            try { proc.Kill(); } catch {}
                            Environment.Exit(99);
                        }
                    }
                }
            } catch (Exception ex) {
                MessageBox.Show("Gagal menjalankan WinNotch: " + ex.Message, "WinNotch Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}

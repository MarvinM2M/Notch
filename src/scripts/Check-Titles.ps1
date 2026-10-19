Add-Type @"
  using System;
  using System.Text;
  using System.Collections.Generic;
  using System.Runtime.InteropServices;

  public class WinHelper {
      public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

      [DllImport("user32.dll")]
      public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

      [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
      public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

      [DllImport("user32.dll")]
      public static extern bool IsWindowVisible(IntPtr hWnd);

      public static List<string> GetTitles() {
          var list = new List<string>();
          EnumWindows((hWnd, lParam) => {
              if (IsWindowVisible(hWnd)) {
                  var sb = new StringBuilder(512);
                  GetWindowText(hWnd, sb, sb.Capacity);
                  string t = sb.ToString().Trim();
                  if (!string.IsNullOrEmpty(t)) {
                      list.Add(t);
                  }
              }
              return true;
          }, IntPtr.Zero);
          return list;
      }
  }
"@

[WinHelper]::GetTitles() | Select-Object -First 35

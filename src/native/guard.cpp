/**
 * WinNotch Native Security Guard & Anti-Tamper Wrapper
 * Language: C++ (Win32 Native)
 * Purpose: Protect WinNotch from tampering, reverse engineering, and debugger inspection.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <tlhelp32.h>
#include <iostream>
#include <string>
#include <vector>

// Anti-Debugging Checks
bool CheckDebuggers() {
    // 1. Basic Win32 API check
    if (IsDebuggerPresent()) {
        return true;
    }

    // 2. Check Remote Debugger
    BOOL isRemoteDebugger = FALSE;
    if (CheckRemoteDebuggerPresent(GetCurrentProcess(), &isRemoteDebugger) && isRemoteDebugger) {
        return true;
    }

    // 3. PEB BeingDebugged flag check
#if defined(_WIN64)
    PPEB pPeb = (PPEB)__readgsqword(0x60);
#else
    PPEB pPeb = (PPEB)__readfsdword(0x30);
#endif
    if (pPeb && *(reinterpret_cast<PBYTE>(pPeb) + 2)) {
        return true;
    }

    // 4. Hardware Breakpoints check (DR0 - DR3)
    CONTEXT ctx = { 0 };
    ctx.ContextFlags = CONTEXT_DEBUG_REGISTERS;
    HANDLE hThread = GetCurrentThread();
    if (GetThreadContext(hThread, &ctx)) {
        if (ctx.Dr0 || ctx.Dr1 || ctx.Dr2 || ctx.Dr3) {
            return true;
        }
    }

    return false;
}

// Blacklisted Reverse Engineering / Tampering Tools
bool CheckBlacklistedTools() {
    const std::vector<std::wstring> badTools = {
        L"x64dbg.exe", L"x32dbg.exe", L"ida64.exe", L"ida.exe",
        L"cheatengine.exe", L"ollydbg.exe", L"fiddler.exe",
        L"charles.exe", L"httpdebuggerui.exe", L"dnspy.exe",
        L"processhacker.exe", L"scylla.exe"
    };

    HANDLE hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnap == INVALID_HANDLE_VALUE) return false;

    PROCESSENTRY32W pe;
    pe.dwSize = sizeof(pe);

    if (Process32FirstW(hSnap, &pe)) {
        do {
            std::wstring procName = pe.szExeFile;
            for (auto& c : procName) c = towlower(c);

            for (const auto& bad : badTools) {
                if (procName == bad) {
                    CloseHandle(hSnap);
                    return true;
                }
            }
        } while (Process32NextW(hSnap, &pe));
    }

    CloseHandle(hSnap);
    return false;
}

// Main Guard Entry Point
int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    // Phase 1: Pre-Execution Security Verification
    if (CheckDebuggers() || CheckBlacklistedTools()) {
        MessageBoxW(NULL, 
            L"WinNotch Security Guard: Sistem mendeteksi aktivitas debugger atau peralatan tidak sah.\nAplikasi akan ditutup demi keamanan.", 
            L"WinNotch Security Warning", 
            MB_ICONERROR | MB_OK);
        ExitProcess(1);
    }

    // Phase 2: Launch Protected WinNotch Process
    WCHAR exePath[MAX_PATH];
    GetModuleFileNameW(NULL, exePath, MAX_PATH);
    std::wstring dir = exePath;
    dir = dir.substr(0, dir.find_last_of(L"\\/"));

    // Target Electron / WinNotch executable
    std::wstring targetCmd = L"\"" + dir + L"\\node_modules\\electron\\dist\\electron.exe\" \"" + dir + L"\"";

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    if (!CreateProcessW(NULL, const_cast<LPWSTR>(targetCmd.c_str()), NULL, NULL, FALSE, 0, NULL, dir.c_str(), &si, &pi)) {
        // Fallback to npm start if standalone electron not directly in dist
        std::wstring fallbackCmd = L"cmd.exe /c npm start";
        CreateProcessW(NULL, const_cast<LPWSTR>(fallbackCmd.c_str()), NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, dir.c_str(), &si, &pi);
    }

    // Phase 3: Continuous Background Tamper Monitoring
    if (pi.hProcess) {
        while (WaitForSingleObject(pi.hProcess, 2000) == WAIT_TIMEOUT) {
            if (CheckDebuggers() || CheckBlacklistedTools()) {
                // Terminate child immediately if tamper detected during runtime
                TerminateProcess(pi.hProcess, 99);
                ExitProcess(99);
            }
        }
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
    }

    return 0;
}

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$databaseDirectory = Join-Path $env:LOCALAPPDATA 'LyczyPersonalFinanceManager'
$databasePath = Join-Path $databaseDirectory 'ledgerly.sqlite'
$port = 5187

New-Item -ItemType Directory -Path $databaseDirectory -Force | Out-Null

$sqliteCode = @'
using System;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;

public static class FinanceDatabase
{
    private const int SqliteRow = 100;
    private const int SqliteDone = 101;
    private static readonly IntPtr SqliteTransient = new IntPtr(-1);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_open(byte[] filename, out IntPtr database);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_close(IntPtr database);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_busy_timeout(IntPtr database, int milliseconds);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_exec(IntPtr database, byte[] sql, IntPtr callback, IntPtr argument, IntPtr error);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_prepare_v2(IntPtr database, byte[] sql, int bytes, out IntPtr statement, IntPtr tail);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_bind_int64(IntPtr statement, int index, long value);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_bind_text(IntPtr statement, int index, byte[] value, int bytes, IntPtr destructor);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_step(IntPtr statement);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern long sqlite3_column_int64(IntPtr statement, int index);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr sqlite3_column_text(IntPtr statement, int index);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_column_bytes(IntPtr statement, int index);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_finalize(IntPtr statement);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr sqlite3_errmsg(IntPtr database);

    private static byte[] Utf8(string value)
    {
        return Encoding.UTF8.GetBytes(value);
    }

    private static IntPtr Open(string path)
    {
        IntPtr database;
        int result = sqlite3_open(Utf8(path + "\0"), out database);
        if (result != 0)
        {
            string message = database == IntPtr.Zero ? "Could not open the database." : Error(database);
            if (database != IntPtr.Zero) sqlite3_close(database);
            throw new InvalidOperationException(message);
        }
        sqlite3_busy_timeout(database, 5000);
        return database;
    }

    private static string Error(IntPtr database)
    {
        return Marshal.PtrToStringAnsi(sqlite3_errmsg(database));
    }

    private static void Execute(IntPtr database, string sql)
    {
        int result = sqlite3_exec(database, Utf8(sql + "\0"), IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
        if (result != 0) throw new InvalidOperationException(Error(database));
    }

    private static IntPtr Prepare(IntPtr database, string sql)
    {
        IntPtr statement;
        int result = sqlite3_prepare_v2(database, Utf8(sql + "\0"), -1, out statement, IntPtr.Zero);
        if (result != 0) throw new InvalidOperationException(Error(database));
        return statement;
    }

    private static void BindText(IntPtr database, IntPtr statement, int index, string value)
    {
        byte[] bytes = Utf8(value);
        if (sqlite3_bind_text(statement, index, bytes, bytes.Length, SqliteTransient) != 0)
            throw new InvalidOperationException(Error(database));
    }

    public static void Initialize(string path)
    {
        IntPtr database = Open(path);
        try
        {
            Execute(database, "PRAGMA journal_mode=WAL;");
            Execute(database, "CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, state_json TEXT NOT NULL);");
        }
        finally
        {
            sqlite3_close(database);
        }
    }

    public static bool Read(string path, out long revision, out string json)
    {
        IntPtr database = Open(path);
        IntPtr statement = IntPtr.Zero;
        try
        {
            statement = Prepare(database, "SELECT revision, state_json FROM app_state WHERE id = 1;");
            int result = sqlite3_step(statement);
            if (result == SqliteDone)
            {
                revision = 0;
                json = null;
                return false;
            }
            if (result != SqliteRow) throw new InvalidOperationException(Error(database));
            revision = sqlite3_column_int64(statement, 0);
            IntPtr text = sqlite3_column_text(statement, 1);
            int length = sqlite3_column_bytes(statement, 1);
            byte[] bytes = new byte[length];
            Marshal.Copy(text, bytes, 0, length);
            json = Encoding.UTF8.GetString(bytes);
            return true;
        }
        finally
        {
            if (statement != IntPtr.Zero) sqlite3_finalize(statement);
            sqlite3_close(database);
        }
    }

    public static bool Write(string path, long expectedRevision, string json, out long revision)
    {
        IntPtr database = Open(path);
        IntPtr statement = IntPtr.Zero;
        try
        {
            Execute(database, "BEGIN IMMEDIATE;");
            long currentRevision = 0;
            statement = Prepare(database, "SELECT revision FROM app_state WHERE id = 1;");
            int result = sqlite3_step(statement);
            if (result == SqliteRow) currentRevision = sqlite3_column_int64(statement, 0);
            else if (result != SqliteDone) throw new InvalidOperationException(Error(database));
            sqlite3_finalize(statement);
            statement = IntPtr.Zero;

            if (currentRevision != expectedRevision)
            {
                Execute(database, "ROLLBACK;");
                revision = currentRevision;
                return false;
            }

            statement = Prepare(database, "INSERT INTO app_state (id, revision, state_json) VALUES (1, ?1, ?2) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, state_json = excluded.state_json;");
            if (sqlite3_bind_int64(statement, 1, currentRevision + 1) != 0)
                throw new InvalidOperationException(Error(database));
            BindText(database, statement, 2, json);
            result = sqlite3_step(statement);
            if (result != SqliteDone) throw new InvalidOperationException(Error(database));
            sqlite3_finalize(statement);
            statement = IntPtr.Zero;
            Execute(database, "COMMIT;");
            revision = currentRevision + 1;
            return true;
        }
        catch
        {
            try { Execute(database, "ROLLBACK;"); } catch { }
            throw;
        }
        finally
        {
            if (statement != IntPtr.Zero) sqlite3_finalize(statement);
            sqlite3_close(database);
        }
    }
}
'@

Add-Type -TypeDefinition $sqliteCode -ErrorAction Stop
[FinanceDatabase]::Initialize($databasePath)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
Write-Host "Lyczy Personal Finance Manager is available at http://127.0.0.1:$port/"
Write-Host "SQLite database: $databasePath"
Write-Host 'Keep this window open while using the app. Press Ctrl+C to stop the server.'

function Send-Response {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [int]$StatusCode,
        [string]$ContentType,
        [byte[]]$Body
    )

    $Response.StatusCode = $StatusCode
    $Response.ContentType = $ContentType
    $Response.Headers['Cache-Control'] = 'no-store'
    $Response.Headers['X-Content-Type-Options'] = 'nosniff'
    $Response.Headers['X-Frame-Options'] = 'DENY'
    $Response.ContentLength64 = $Body.Length
    $Response.OutputStream.Write($Body, 0, $Body.Length)
    $Response.Close()
}

function Send-Json {
    param([System.Net.HttpListenerResponse]$Response, [int]$StatusCode, [string]$Json)
    Send-Response $Response $StatusCode 'application/json; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes($Json))
}

function Get-EmptyState {
    $categories = '["Food & dining","Transport","Shopping","Home","Health","Bills","Travel","Income","Entertainment","Other","Uncategorized"]'
    $emptyBudget = '{"transactions":[],"categories":' + $categories + ',"duplicates":[],"dismissedDuplicates":[]}'
    '{"version":3,"activeBudgetId":"erste","budgets":{"erste":' + $emptyBudget + ',"bnp":' + $emptyBudget + '}}'
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        try {
            $hostName = $request.Url.Host.ToLowerInvariant()
            if ($hostName -notin @('127.0.0.1', 'localhost')) {
                Send-Json $response 403 '{"error":"Only local browser access is allowed."}'
                continue
            }

            if ($request.HttpMethod -eq 'GET' -and $request.Url.AbsolutePath -eq '/api/state') {
                $revision = [long]0
                $json = $null
                $exists = [FinanceDatabase]::Read($databasePath, [ref]$revision, [ref]$json)
                if (-not $exists) {
                    $json = Get-EmptyState
                }
                Send-Json $response 200 ('{"revision":' + $revision + ',"state":' + $json + '}')
                continue
            }

            if ($request.HttpMethod -eq 'PUT' -and $request.Url.AbsolutePath -eq '/api/state') {
                $origin = $request.Headers['Origin']
                if ($origin -and $origin -notin @("http://127.0.0.1:$port", "http://localhost:$port")) {
                    Send-Json $response 403 '{"error":"Cross-origin updates are not allowed."}'
                    continue
                }
                if ($request.ContentType -notmatch '^application/json(?:\s*;|$)') {
                    Send-Json $response 415 '{"error":"Content-Type must be application/json."}'
                    continue
                }
                if ($request.ContentLength64 -gt 5242880) {
                    Send-Json $response 413 '{"error":"The database update is too large."}'
                    continue
                }

                $reader = New-Object IO.StreamReader($request.InputStream, [Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Dispose()
                try {
                    $update = $body | ConvertFrom-Json -ErrorAction Stop
                    $state = $update.state
                    if ($null -eq $update.expectedRevision -or
                        $update.expectedRevision -lt 0 -or
                        $state.version -ne 3 -or
                        $state.activeBudgetId -notin @('erste', 'bnp') -or
                        $null -eq $state.budgets.erste -or
                        $null -eq $state.budgets.bnp -or
                        $state.budgets.erste.transactions -isnot [array] -or
                        $state.budgets.bnp.transactions -isnot [array] -or
                        $state.budgets.erste.categories -isnot [array] -or
                        $state.budgets.bnp.categories -isnot [array]) {
                        throw 'The state payload is missing required budget data.'
                    }
                }
                catch {
                    Send-Json $response 400 ('{"error":' + (ConvertTo-Json -InputObject $_.Exception.Message -Compress) + '}')
                    continue
                }

                $newRevision = [long]0
                $written = [FinanceDatabase]::Write(
                    $databasePath,
                    [long]$update.expectedRevision,
                    (ConvertTo-Json -InputObject $state -Depth 100 -Compress),
                    [ref]$newRevision
                )
                if (-not $written) {
                    Send-Json $response 409 ('{"error":"Data changed in another browser. Reload the page before saving.","revision":' + $newRevision + '}')
                    continue
                }
                Send-Json $response 200 ('{"revision":' + $newRevision + '}')
                continue
            }

            if ($request.HttpMethod -eq 'GET') {
                $file = switch ($request.Url.AbsolutePath) {
                    '/' { Join-Path $root 'index.html' }
                    '/index.html' { Join-Path $root 'index.html' }
                    '/app.js' { Join-Path $root 'app.js' }
                    '/styles.css' { Join-Path $root 'styles.css' }
                    default { $null }
                }
                if ($file -and (Test-Path -LiteralPath $file -PathType Leaf)) {
                    $contentType = if ($file.EndsWith('.js')) { 'text/javascript; charset=utf-8' }
                        elseif ($file.EndsWith('.css')) { 'text/css; charset=utf-8' }
                        else { 'text/html; charset=utf-8' }
                    Send-Response $response 200 $contentType ([IO.File]::ReadAllBytes($file))
                    continue
                }
            }

            Send-Json $response 404 '{"error":"Not found."}'
        }
        catch {
            Write-Error "Request failed: $($_.Exception.Message)"
            if ($response.OutputStream.CanWrite) {
                try { Send-Json $response 500 '{"error":"The local server could not process the request."}' } catch {}
            }
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}

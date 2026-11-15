using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

static class App
{
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, int m, int w, int l);

    const string Shim = "window.gpaDesktop={resize:function(h){chrome.webview.postMessage('r'+h)},toggleTop:function(){window.__t=!window.__t;chrome.webview.postMessage('t'+(window.__t?1:0));return Promise.resolve(window.__t)}};document.addEventListener('mousedown',function(e){if(location.hash==='#widget'&&e.button===0&&!e.target.closest('a,button,input,select'))chrome.webview.postMessage('d')});";

    static string dir = AppDomain.CurrentDomain.BaseDirectory;
    static string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "GPA Planner");
    static string posFile = Path.Combine(root, "widget.txt");
    static CoreWebView2Environment env;
    static Form widget, main;
    static NotifyIcon tray;
    static Icon icon;
    static bool quitting, pinned;
    static string import;
    static float scale = 1f;

    static bool Dark()
    {
        try { return (int)Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize").GetValue("AppsUseLightTheme") == 0; }
        catch { return false; }
    }

    static Form MakeForm(int w, int h)
    {
        Form f = new Form();
        f.Icon = icon;
        f.BackColor = Dark() ? Color.FromArgb(17, 17, 19) : Color.FromArgb(251, 251, 250);
        f.ClientSize = new Size((int)(w * scale), (int)(h * scale));
        return f;
    }

    [STAThread]
    static void Main(string[] args)
    {
        bool first;
        Mutex mu = new Mutex(true, "gpa-planner-single", out first);
        EventWaitHandle sig = new EventWaitHandle(false, EventResetMode.AutoReset, "gpa-planner-show");
        if (!first) { sig.Set(); return; }
        foreach (string a in args) if (a.StartsWith("--import=")) import = File.ReadAllText(a.Substring(9));
        Application.EnableVisualStyles();
        Directory.CreateDirectory(root);
        try { Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true).SetValue("GPA Planner", "\"" + Application.ExecutablePath + "\""); } catch { }
        icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        using (Graphics g = Graphics.FromHwnd(IntPtr.Zero)) scale = g.DpiX / 96f;

        widget = MakeForm(300, 300);
        widget.FormBorderStyle = FormBorderStyle.None;
        widget.ShowInTaskbar = false;
        widget.StartPosition = FormStartPosition.Manual;
        Rectangle wa = Screen.PrimaryScreen.WorkingArea;
        widget.Location = new Point(wa.Right - widget.Width - 24, wa.Top + 24);
        try { string[] p = File.ReadAllText(posFile).Split(','); widget.Location = new Point(int.Parse(p[0]), int.Parse(p[1])); } catch { }
        widget.LocationChanged += delegate { if (widget.Visible) { try { File.WriteAllText(posFile, widget.Left + "," + widget.Top); } catch { } } };
        widget.FormClosing += delegate(object s, FormClosingEventArgs e) { if (!quitting) e.Cancel = true; };
        widget.Shown += delegate { widget.TopMost = true; widget.TopMost = pinned; };
        widget.Load += async delegate
        {
            env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(root, "wv"));
            await Attach(widget, "https://gpa.local/index.html#widget");
        };

        tray = new NotifyIcon();
        tray.Icon = icon;
        tray.Text = "GPA Planner";
        ContextMenuStrip m = new ContextMenuStrip();
        m.Items.Add("Open GPA Planner", null, delegate { ShowMain(); });
        m.Items.Add("Show widget", null, delegate { widget.Show(); widget.TopMost = true; widget.TopMost = pinned; });
        ToolStripMenuItem pin = new ToolStripMenuItem("Keep widget on top");
        pin.CheckOnClick = true;
        pin.CheckedChanged += delegate { pinned = pin.Checked; widget.TopMost = pinned; };
        m.Items.Add(pin);
        m.Items.Add("-");
        m.Items.Add("Quit", null, delegate { quitting = true; tray.Visible = false; Application.Exit(); });
        tray.ContextMenuStrip = m;
        tray.MouseClick += delegate(object s, MouseEventArgs e) { if (e.Button == MouseButtons.Left) ShowMain(); };
        tray.Visible = true;

        ThreadPool.RegisterWaitForSingleObject(sig, delegate { widget.BeginInvoke(new Action(ShowMain)); }, null, -1, false);
        Application.Run(widget);
    }

    static void ShowMain()
    {
        if (main == null || main.IsDisposed)
        {
            main = MakeForm(1180, 820);
            main.Text = "GPA Planner";
            main.StartPosition = FormStartPosition.CenterScreen;
            main.FormClosing += delegate(object s, FormClosingEventArgs e) { if (!quitting) { e.Cancel = true; main.Hide(); } };
            Attach(main, "https://gpa.local/index.html");
        }
        main.Show();
        main.WindowState = FormWindowState.Normal;
        main.Activate();
    }

    static async Task Attach(Form f, string url)
    {
        WebView2 wv = new WebView2();
        wv.Dock = DockStyle.Fill;
        wv.DefaultBackgroundColor = f.BackColor;
        f.Controls.Add(wv);
        await wv.EnsureCoreWebView2Async(env);
        CoreWebView2 c = wv.CoreWebView2;
        c.SetVirtualHostNameToFolderMapping("gpa.local", Path.Combine(dir, "web"), CoreWebView2HostResourceAccessKind.Allow);
        c.Settings.AreDevToolsEnabled = false;
        c.Settings.AreDefaultContextMenusEnabled = false;
        c.Settings.IsStatusBarEnabled = false;
        await c.AddScriptToExecuteOnDocumentCreatedAsync(Shim);
        c.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; ShowMain(); };
        if (f == widget) c.WebMessageReceived += OnMsg;
        if (f == widget && import != null)
        {
            string lit = new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.Serialize(import);
            import = null;
            EventHandler<CoreWebView2NavigationCompletedEventArgs> h = null;
            h = async delegate(object s, CoreWebView2NavigationCompletedEventArgs e)
            {
                c.NavigationCompleted -= h;
                await c.ExecuteScriptAsync("localStorage.setItem('gpa-planner-v2'," + lit + ")");
                c.Reload();
            };
            c.NavigationCompleted += h;
        }
        c.Navigate(url);
    }

    static void OnMsg(object s, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string m = e.TryGetWebMessageAsString();
        if (string.IsNullOrEmpty(m)) return;
        string v = m.Substring(1);
        if (m[0] == 'r') { int h; if (int.TryParse(v, out h)) widget.ClientSize = new Size((int)(300 * scale), (int)(Math.Max(120, Math.Min(720, h)) * scale)); }
        else if (m[0] == 't') { pinned = v == "1"; widget.TopMost = pinned; }
        else if (m[0] == 'd') { ReleaseCapture(); SendMessage(widget.Handle, 0xA1, 2, 0); }
    }
}

# Playwright MCP Server

## Overview

The **Playwright** server provides **browser automation capabilities** for Claude Code, enabling web interaction, scraping, testing, and structured accessibility-based navigation.

---

## Installation

### Step 1: Basic Installation

#### Global Installation (Recommended)

```bash
claude mcp add playwright -s user -- npx -y @playwright/mcp@latest
```

#### Local Installation (Project-Specific)

```bash
claude mcp add playwright -s local -- npx -y @playwright/mcp@latest
```

---

## Advanced Configuration

### Step 2: Configuration Options

#### Specify Browser Type

```bash
claude mcp add playwright -s user -- npx -y @playwright/mcp@latest --browser chrome
```

Available browsers: `chrome`, `firefox`, `webkit`, `msedge`

#### Enable Headless Mode

```bash
claude mcp add playwright -s user -- npx -y @playwright/mcp@latest --headless
```

> **Note:** Headless mode runs the browser without a visible window.

#### Block Specific Origins

```bash
claude mcp add playwright -s user -- npx -y @playwright/mcp@latest --blocked-origins "https://ads.example.com;https://tracking.example.com"
```

Use semicolons (`;`) to separate multiple origins.

#### Emulate Specific Device

```bash
claude mcp add playwright -s user -- npx -y @playwright/mcp@latest --device "iPhone 15"
```

---

## Configuration File

### Step 3: Using a JSON Configuration

For complex setups, use a configuration file:

#### Create `playwright-mcp-config.json`

```json
{
  "browser": {
    "browserName": "chromium",
    "isolated": true,
    "launchOptions": {
      "headless": false,
      "channel": "chrome"
    }
  }
}
```

#### Install with Configuration

```bash
claude mcp add playwright -s user -- npx -y @playwright/mcp@latest --config /path/to/playwright-mcp-config.json
```

---

## Usage

### Step 4: Using Playwright in Claude Code

#### Open a Browser

In a Claude session:

```
"Use playwright mcp to open a browser to example.com"
```

**Behavior:**
- Playwright uses the **accessibility tree** by default (fast, lightweight)
- A visible browser window can be controlled by Claude
- **Manual authentication**: Login through the browser; cookies persist for the session

#### View Available Tools

Type in Claude:

```
/mcp
```

Then select **playwright** to see available tools. The most useful ones include:

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_snapshot` | Capture an accessibility snapshot of the page |
| `browser_take_screenshot` | Take a visual screenshot of the page |
| `browser_click` | Click an element on the page |
| `browser_type` | Type text into an editable element |
| `browser_fill_form` | Fill multiple form fields at once |
| `browser_select_option` | Select an option in a dropdown |
| `browser_evaluate` | Run JavaScript on the page |
| `browser_wait_for` | Wait for text to appear/disappear or time to pass |
| `browser_tabs` | List, create, close, or switch browser tabs |

See the [Playwright MCP README](https://github.com/microsoft/playwright-mcp/blob/main/README.md) for the full tool list, including network mocking, storage, tracing, and PDF export tools.

---

## Features

- **Accessibility-first navigation**: Uses accessibility tree for fast, structured interaction
- **Browser automation**: Automate clicks, form fills, and navigation
- **Web scraping**: Extract data from websites programmatically
- **Screenshot capture**: Take screenshots for documentation or debugging
- **JavaScript execution**: Run custom scripts in the browser context
- **Device emulation**: Test on different devices and screen sizes
- **Origin blocking**: Block ads, trackers, or unwanted domains

---

## Verification

Verify Playwright is connected:

```bash
claude mcp list
```

Expected output:

```
playwright: npx -y @playwright/mcp@latest - ✓ Connected
```

---

## Best Practices

- Use **global installation** for consistent access across projects
- Enable **headless mode** for automated testing without GUI
- Use **device emulation** for responsive testing
- Block **tracking domains** to speed up page loads
- Configure via **JSON file** for complex, reusable setups

---

## Use Cases

- Automated web scraping for data collection
- Cross-browser testing for web applications
- Screenshot generation for documentation
- Form automation for testing workflows
- Accessibility testing with the accessibility tree
- Web data extraction for research or analysis

---

## Troubleshooting

If Playwright fails to connect:

1. **Verify Node.js installation:**
   ```bash
   node --version
   npx --version
   ```

2. **Test Playwright directly:**
   ```bash
   npx @playwright/mcp@latest --help
   ```

3. **Install missing browser binaries:**
   ```bash
   npx playwright install chromium
   ```

4. **Check for port conflicts** or firewall issues

5. **On Windows**, ensure Google Chrome is installed

6. **Verify headless setting**: If browser is not visible, ensure `--headless` is not set

For more help, see the [Troubleshooting Guide](./README.md#troubleshooting).
# Land Contract Dashboard - Windows Setup Guide

## 📋 Prerequisites

Before running this project on Windows, make sure you have:

1. **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
2. **pnpm** - Install via: `npm install -g pnpm`
3. **Git** (optional, for version control) - [Download here](https://git-scm.com/)

---

## 🚀 Quick Start

### First Time Setup

1. **Install Dependencies**
   ```
   Double-click: install.bat
   ```
   This will install all required packages. Wait for completion.

2. **Configure Environment**
   - The `.env` file is already configured with system variables
   - No manual configuration needed for Manus-hosted deployment

3. **Start the Server**
   ```
   Double-click: start.bat
   ```
   Server will start at: `http://localhost:3000`

---

## 📁 Batch Files Reference

### `install.bat`
- **Purpose:** Initial project setup
- **When to use:** First time only, or after cloning the repository
- **What it does:**
  - Checks if pnpm is installed
  - Installs all project dependencies
  - Shows next steps after completion

### `start.bat`
- **Purpose:** Start the development server
- **When to use:** Every time you want to run the project
- **What it does:**
  - Checks if dependencies are installed
  - Starts both backend and frontend servers
  - Opens the application at `http://localhost:3000`
- **To stop:** Press `Ctrl+C` in the terminal window

### `update.bat`
- **Purpose:** Update project dependencies
- **When to use:** After pulling new code or when dependencies change
- **What it does:**
  - Updates all packages to latest versions
  - Reinstalls dependencies if needed

---

## 🔧 Troubleshooting

### "pnpm is not recognized"
**Solution:** Install pnpm globally
```bash
npm install -g pnpm
```

### "Dependencies not installed"
**Solution:** Run `install.bat` first

### Port 3000 already in use
**Solution:** 
1. Close other applications using port 3000
2. Or change the port in `server/_core/index.ts`

### Database connection errors
**Solution:**
- This project uses Manus-managed database
- No local database configuration needed
- Ensure you're connected to the internet

---

## 📚 Project Structure

```
land-contract-dashboard/
├── client/              # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/      # Page components
│   │   ├── components/ # Reusable UI components
│   │   └── lib/        # Utilities and tRPC client
│   └── public/         # Static assets
├── server/             # Backend (Express + tRPC)
│   ├── routers.ts      # API endpoints
│   ├── db.ts           # Database queries
│   └── _core/          # Framework code
├── drizzle/            # Database schema
├── start.bat           # Start development server
├── update.bat          # Update dependencies
└── install.bat         # Initial setup
```

---

## 🌐 Deployment

This project is designed to be deployed on Manus platform:

1. Make changes locally
2. Test with `start.bat`
3. Publish via Manus Management UI
4. Access at your custom domain (e.g., `pay.gtlands.com`)

---

## 💡 Tips

- **Keep terminal open:** Don't close the window while the server is running
- **Hot reload:** Changes to code will automatically refresh the browser
- **Database:** All data is stored in Manus-managed cloud database
- **Backups:** Use the "Download Backup" button in Settings page

---

## 📞 Support

For issues or questions:
- Check the main README.md for detailed documentation
- Review the code comments in key files
- Contact Manus support at https://help.manus.im

---

**Happy coding! 🚀**

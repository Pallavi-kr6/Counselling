# Counselling AI App

A production-ready full-stack application for mental health, featuring a secure database, appointment booking, and an integrated AI counselling bot.

## How to run this project

This project is split into a **backend** (Node.js/Express) and a **frontend** (React) folder.

### 1. Prerequisites
- Node.js (v16+)
- npm

### 2. Environment Variables

Create a `.env` file in the root directory (or inside `/backend`). You will need the following credentials:
```env
PORT=5001
OPENAI_API_KEY=your_openai_api_key  # Optional: used for real AI chat. Falls back to mock if missing.
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret
RECOVERY_URL=http://localhost:3000/reset-password
```

### 3. Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the continuous dev server:
   ```bash
   npm run dev
   ```

### 4. Frontend Setup

Open a **new terminal tab**:

1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the React app:
   ```bash
   npm start
   ```

The frontend will run at `http://localhost:3000` and the backend at `http://localhost:5001`.

## Features
- **AI Counselling Bot:** Contextual, empathetic mock & real AI integrated chat logic. 
- **User Authentication:** Robust auth with Supabase and JWT.
- **Appointments & Analytics:** Counsellor flow with schedules and detailed mood reports.

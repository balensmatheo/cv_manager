# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CV App is a cloud-native CV management application for Decision Network. Users create, edit, and export professional CVs in PDF/JSON formats. Features AI-powered PDF parsing via AWS Bedrock (Claude Haiku), a directory system, and admin controls.

**Stack**: React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + AWS Amplify Gen2 (Cognito, DynamoDB, Lambda, S3, Bedrock)

## Commands

```bash
npm run dev      # Vite dev server (localhost:5173)
npm run build    # TypeScript check + Vite bundle
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Architecture

### Frontend Structure

- `src/App.tsx` - Root component: CV display, PDF export/import, print controls
- `src/context/ResumeContext.tsx` - CV data state (localStorage fallback for offline)
- `src/context/AuthContext.tsx` - Cognito auth state, user groups
- `src/components/CV.tsx` - DN theme CV template (violet and white)
- `src/components/CVClassic.tsx` - Classic sidebar CV template
- `src/components/AuthPage.tsx` - Custom Cognito auth UI
- `src/components/Sidebar.tsx` - Fixed left navigation
- `src/components/CvAgent.tsx` - AI assistant interface for CV suggestions
- `src/components/Editable.tsx` - Inline editing components
- `src/components/SortableList.tsx` - Drag-and-drop (@dnd-kit)
- `src/data/resume.json` - Default CV data template

### Pages

- `src/pages/MyCvsPage.tsx` - User's CV list management
- `src/pages/ProfilePage.tsx` - User profile settings
- `src/pages/DirectoryPage.tsx` - Admin-only directory of all users' CVs
- `src/pages/AdminPage.tsx` - Admin controls, usage tracking, user promotion

### Backend (amplify/)

- `amplify/backend.ts` - Central infra config (Cognito, DynamoDB, S3, Lambda)
- `amplify/auth/resource.ts` - Cognito User Pool + Identity Pool
- `amplify/storage/resource.ts` - S3 bucket for private CV storage
- `amplify/data/resource.ts` - GraphQL API definition
- Lambda functions in `amplify/functions/`:
  - `parse-pdf` - Bedrock Claude: PDF text extraction to JSON CV
  - `cv-agent` / `cv-agent-stream` - AI suggestions (streaming via Function URL)
  - `get-usage` / `get-all-usage` - DynamoDB rate limiting queries
  - `admin-config` - Admin settings management
  - `list-users` / `promote-user` - Cognito group management
  - `get-user-cv` - S3 retrieval with identity mapping
  - `send-cv-email` - SES email delivery

## Key Patterns

- **Multi-CV storage**: S3 at `private/{identityId}/cvs/{cvId}.json` with index at `private/{identityId}/cv-index.json`
- **Rate limiting**: DynamoDB tracks Bedrock invocations per user with TTL
- **PDF export**: Browser print dialog with A4 scaling, `.no-print` CSS class hides UI
- **PDF import**: Client-side PDF.js text extraction + Bedrock Claude parsing
- **Two templates**: "dn" (Decision Network violet/white) and "classic" (sidebar layout)
- **Inline styles + Tailwind**: Chosen for simpler print handling
- **AI integration**: Bedrock Claude Haiku for cost-efficient parsing and suggestions

## Authentication

AWS Cognito with MFA/TOTP support. Two groups:
- **Admins**: Directory access, user promotion, usage monitoring
- **Users**: Personal CV management

## Important Files

- `src/App.tsx` - Main component (2600+ lines)
- `amplify/backend.ts` - Infrastructure config
- `src/context/ResumeContext.tsx` - CV data state management
- `src/components/CV.tsx` - Primary CV template

Quand tu push, fait le sur le remote codecommit.

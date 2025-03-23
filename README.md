# StudySets DAIN Service

A DAIN service for generating educational study sets on any subject. This service creates multiple-choice questions for study and learning purposes.

## Technologies Used

The StudySets DAIN service is built with the following libraries and frameworks:

### Core Dependencies

- **@dainprotocol/service-sdk** - Framework for building DAIN services
- **@dainprotocol/utils** - UI building utilities for DAIN protocol
- **@supabase/supabase-js** - JavaScript client for Supabase database
- **OpenAI** - AI model integration for generating study questions
- **zod** - TypeScript-first schema validation library

### Database

The service uses Supabase as its database backend:

- **Supabase** - Open source Firebase alternative with PostgreSQL database

### AI Integration

- **OpenAI GPT-4o** - Used for generating high-quality study questions
- **OpenAI GPT-3.5 Turbo** - Used for generating study set names and classification

### UI Components

The service utilizes various UI builders from the DAIN protocol:

- **CardUIBuilder** - For creating card-based UI components
- **TableUIBuilder** - For creating table-based UI components
- **LayoutUIBuilder** - For creating layout structures

## Environment Setup

The service requires the following environment variables:

- `PORT` - Port to run the service on (defaults to 2022)
- `OPENAI_API_KEY` - API key for OpenAI services
- `NEXT_PUBLIC_SUPABASE_URL` - URL for your Supabase instance
- `SUPABASE_SERVICE_KEY` - Service role API key for Supabase
- `DAIN_API_KEY` - API key for DAIN protocol

## Features

- Generate study sets with multiple-choice questions on any subject
- Save study sets to a database for future reference
- Adjust difficulty level (easy, medium, hard)
- Categorize questions by subject area
- Provide explanations for correct answers

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables
4. Run the service with `npm start`

The service will be available at the specified port (default: 2022).

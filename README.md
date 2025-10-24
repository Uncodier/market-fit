# Makinari - Growth Engine

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.6-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-blue)](https://www.typescriptlang.org/)

> An AI-powered marketing analytics and automation platform that transforms how businesses manage leads, campaigns, and growth.

## 🚀 Overview

Makinari is a comprehensive growth engine platform designed to help businesses optimize their marketing efforts through AI-powered analytics, automated lead management, and intelligent campaign orchestration. Built with modern web technologies, it provides a complete solution for marketing teams to track, analyze, and optimize their growth strategies.

## ✨ Key Features

### 🤖 AI-Powered Analytics
- **Lead Management & Qualification**: Intelligent lead scoring and automated qualification processes
- **Customer Segmentation**: Advanced ICP (Ideal Customer Profile) analysis and segmentation tools
- **ROI Calculator**: Comprehensive return on investment analysis with fuzzy recommendations
- **Revenue Analytics**: Real-time revenue tracking and performance metrics

### 📊 Campaign Management
- **Multi-Channel Campaigns**: Email, social media, content, and paid advertising campaigns
- **A/B Testing**: Built-in experimentation framework for campaign optimization
- **Performance Tracking**: Detailed analytics for reach, engagement, conversion rates, and ROI
- **Campaign Automation**: Automated workflows and scheduling

### 💼 Sales & Pipeline Management
- **Sales Pipeline**: Visual pipeline management with customizable stages
- **Opportunity Tracking**: Deal progression tracking with value and close date management
- **Revenue Forecasting**: Predictive analytics for sales performance
- **Customer Journey Mapping**: Complete customer lifecycle tracking

### 📝 Content Management
- **Content Creation**: AI-assisted content generation and management
- **Content Library**: Organized content repository with tagging and categorization
- **Content Performance**: Analytics for content engagement and conversion
- **Multi-Format Support**: Blog posts, videos, podcasts, social media, and more

### 🔧 Automation & Integration
- **Task Automation**: Control center for automated task management
- **WhatsApp/Twilio Integration**: Multi-channel communication capabilities
- **Stripe Billing**: Integrated payment processing and subscription management
- **API Integrations**: Webhook support and third-party service connections

### 👥 Team Collaboration
- **Multi-Site Support**: Manage multiple business sites from one platform
- **Role-Based Access**: Admin, Editor, and Viewer permission levels
- **Team Management**: Invite and manage team members with granular permissions
- **Activity Tracking**: Real-time activity monitoring and notifications

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 15.5.6 with React 18.2.0
- **UI Components**: Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for data visualization
- **Maps**: React Map GL with Mapbox integration

### Backend & Database
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with magic links
- **Real-time**: Supabase real-time subscriptions
- **API**: Next.js API routes with TypeScript

### Integrations & Services
- **Payments**: Stripe for billing and subscriptions
- **Communications**: Twilio for SMS and WhatsApp
- **File Storage**: Supabase Storage
- **Email**: Integrated email marketing capabilities

### Development & Testing
- **Language**: TypeScript 4.9.5
- **Testing**: Jest with React Testing Library
- **Linting**: ESLint with TypeScript support
- **Code Quality**: Automated linting and formatting

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn package manager
- Supabase account
- Stripe account (for payments)
- Twilio account (for communications)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/makinari.git
   cd makinari
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure your environment variables (see [Environment Variables Documentation](docs/ENVIRONMENT_VARIABLES.md) for detailed setup).

4. **Database Setup**
   ```bash
   # Run database migrations
   npm run db:migrate
   
   # Seed initial data (optional)
   npm run db:seed
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
makinari/
├── app/                    # Next.js app directory
│   ├── components/        # Reusable UI components
│   ├── api/              # API routes
│   ├── agents/           # AI agent implementations
│   ├── campaigns/        # Campaign management
│   ├── leads/            # Lead management
│   ├── segments/         # Customer segmentation
│   └── ...
├── lib/                  # Shared utilities and services
│   ├── supabase/         # Database client and utilities
│   ├── services/         # Business logic services
│   └── utils.ts          # Common utilities
├── components/           # Global UI components
├── docs/                 # Documentation
├── scripts/              # Database and utility scripts
├── public/               # Static assets
└── types/                # TypeScript type definitions
```

## 🧪 Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run test             # Run test suite
npm run test:watch       # Run tests in watch mode

# Database
npm run db:migrate        # Run database migrations
npm run db:seed          # Seed database with test data
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test files
npm test -- --testPathPattern=components
```

## 📚 Documentation

- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md)
- [Stripe Setup](docs/STRIPE_SETUP.md)
- [Google Auth Setup](docs/GOOGLE_AUTH_SETUP.md)
- [Magic Links Setup](docs/MAGIC_LINKS_SETUP.md)
- [Performance Optimizations](docs/PERFORMANCE_OPTIMIZATIONS.md)
- [API Documentation](docs/API.md)

## 🤝 Contributing

We welcome contributions to Makinari! However, please note that this project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

### AGPL-3.0 Requirements

This license requires that:
- Any modifications to the code must be shared under the same license
- If you use this software over a network (including web applications), you must provide the source code to users
- You cannot create proprietary derivatives without open-sourcing your changes

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

### What this means:

- ✅ **Commercial use**: You can use this software commercially
- ✅ **Modification**: You can modify the code
- ✅ **Distribution**: You can distribute the software
- ✅ **Patent use**: Patent rights are granted to users
- ❌ **Proprietary derivatives**: You cannot create closed-source derivatives
- ❌ **Network use without source**: If used over a network, source code must be available

### Why AGPL-3.0?

The AGPL-3.0 license is specifically designed for network-based applications like Makinari. It ensures that:

1. **No direct competition**: Competitors cannot use our code to build competing services without contributing back
2. **Open source ecosystem**: All improvements and modifications must be shared with the community
3. **Network use protection**: Even when used as a service, the source code must remain available

For the full license text, see [LICENSE](LICENSE).

## 🔒 Security

If you discover a security vulnerability, please report it to security@makinari.com instead of using the public issue tracker.

## 📞 Support

- 📧 Email: support@makinari.com
- 📖 Documentation: [docs.makinari.com](https://docs.makinari.com)
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/makinari/issues)

---

**Makinari** - Empowering growth through intelligent marketing automation.



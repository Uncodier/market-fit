import React from 'react';

interface SectionProps {
  badgeText?: string;
  badgeSubText?: string;
  titleMain?: string;
  titleHighlight?: string;
  titleSub?: string;
  subtitle?: string;
  buttonPrimaryText?: string;
  buttonPrimaryUrl?: string;
  buttonSecondaryText?: string;
  buttonSecondaryUrl?: string;
  logos?: string[];
}

const HeroSection: React.FC<SectionProps> = ({
  badgeText = '12K+',
  badgeSubText = 'GROWING BUSINESSES',
  titleMain = 'Get Market Fit',
  titleHighlight = 'AI Growth',
  titleSub = 'Your Team',
  subtitle = 'You are just one click away from transforming your business with powerful AI automated marketing.',
  buttonPrimaryText = 'Use it Free',
  buttonPrimaryUrl = './#:enp052Dlq',
  buttonSecondaryText = 'How it Works',
  buttonSecondaryUrl = './#how-it-works',
  logos = [
    'https://framerusercontent.com/images/VjmsqHeWTpcOeQ1me9Gtc9adLE.svg',
    'https://framerusercontent.com/images/bcIHofRAGz07Cl47alk4eZweX78.svg',
    'https://framerusercontent.com/images/KM1Q6ZA4hUHuWvz4cOZsQI9v0.svg',
    'https://framerusercontent.com/images/RZk0FOpNrZ9xFwKUFoQlbL1alzE.svg',
    'https://framerusercontent.com/images/LNsbmxTCNLUk4k4J45n8VhPQeWY.svg',
    'https://framerusercontent.com/images/1ehZ5pYQJiXu4sArrnMFIo21CAU.svg',
  ],
}) => {
  return (
    <section className="hero-section">
      <div className="hero-content">
        {/* Badge */}
        <div className="badge">
          <div className="badge-circle">
            <span className="badge-text">{badgeText}</span>
          </div>
          <p className="badge-subtext">{badgeSubText}</p>
        </div>

        {/* Title */}
        <div className="title">
          <h1 className="title-main">{titleMain}</h1>
          <h1 className="title-highlight">
            <span className="highlight">{titleHighlight}</span>
          </h1>
          <h1 className="title-sub">{titleSub}</h1>
        </div>

        {/* Subtitle */}
        <p className="subtitle">{subtitle}</p>

        {/* Buttons */}
        <div className="cta-buttons">
          <a href={buttonPrimaryUrl} className="button-primary">
            {buttonPrimaryText}
          </a>
          <a href={buttonSecondaryUrl} className="button-secondary">
            {buttonSecondaryText}
          </a>
        </div>

        {/* Logos */}
        <div className="logos">
          {logos.map((logo, index) => (
            <img key={index} src={logo} alt={`Logo ${index + 1}`} className="logo" />
          ))}
        </div>
      </div>

      {/* Background */}
      <div className="background-overlay"></div>

      <style jsx>{`
        .hero-section {
          position: relative;
          padding: 50px 20px;
          text-align: center;
          color: #465478;
          overflow: hidden;
        }

        .hero-content {
          position: relative;
          z-index: 2;
        }

        .badge {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 20px;
        }

        .badge-circle {
          background: #7584d6;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: 0px 2px 4px rgba(189, 200, 223, 0.1);
        }

        .badge-text {
          color: #fff;
          font-size: 16px;
          font-weight: bold;
        }

        .badge-subtext {
          color: #7584d6;
          font-size: 14px;
          margin-top: 10px;
        }

        .title-main {
          font-size: 48px;
          font-weight: bold;
          margin: 0;
        }

        .title-highlight {
          font-size: 48px;
          font-weight: bold;
          margin: 0;
        }

        .highlight {
          background: linear-gradient(108deg, #80e5ff 8%, #7584d6 49%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .title-sub {
          font-size: 48px;
          font-weight: bold;
          margin: 0;
        }

        .subtitle {
          font-size: 18px;
          color: #465478;
          margin: 20px 0;
        }

        .cta-buttons {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 20px;
        }

        .button-primary {
          background: linear-gradient(123deg, #5967b5 -12%, #908eed 88%);
          color: #fff;
          padding: 10px 20px;
          border-radius: 24px;
          text-decoration: none;
          box-shadow: 0px 0.5px 0.3px rgba(136, 138, 227, 0.47);
        }

        .button-secondary {
          background: linear-gradient(123deg, #f9fafb -12%, #fff 88%);
          color: #465478;
          padding: 10px 20px;
          border-radius: 24px;
          text-decoration: none;
          box-shadow: 0px 0.5px 0.3px rgba(136, 138, 227, 0.29);
        }

        .logos {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 40px;
        }

        .logo {
          width: 120px;
          height: auto;
        }

        .background-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(128, 229, 255, 0.3) 0%, rgba(117, 132, 214, 0.3) 100%);
          z-index: 1;
        }
      `}</style>
    </section>
  );
};

export default HeroSection;
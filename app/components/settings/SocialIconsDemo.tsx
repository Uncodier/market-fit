"use client"

import { 
  SocialIcon,
  FacebookIcon,
  TwitterIcon,
  InstagramIcon,
  LinkedInIcon,
  YouTubeIcon,
  TikTokIcon,
  PinterestIcon,
  GitHubIcon,
  RedditIcon,
  MediumIcon,
  WhatsAppIcon,
  TelegramIcon,
  DiscordIcon,
  GlobeIcon
} from "../ui/social-icons"

import { Button } from "../ui/button"
import { useState } from "react"

// Componente que muestra todos los íconos disponibles
export default function SocialIconsDemo() {
  const [size, setSize] = useState(24);
  
  const socialIcons = [
    { name: "Facebook", component: <FacebookIcon size={size} />, platform: "facebook" },
    { name: "Twitter", component: <TwitterIcon size={size} />, platform: "twitter" },
    { name: "Instagram", component: <InstagramIcon size={size} />, platform: "instagram" },
    { name: "LinkedIn", component: <LinkedInIcon size={size} />, platform: "linkedin" },
    { name: "YouTube", component: <YouTubeIcon size={size} />, platform: "youtube" },
    { name: "TikTok", component: <TikTokIcon size={size} />, platform: "tiktok" },
    { name: "Pinterest", component: <PinterestIcon size={size} />, platform: "pinterest" },
    { name: "GitHub", component: <GitHubIcon size={size} />, platform: "github" },
    { name: "Reddit", component: <RedditIcon size={size} />, platform: "reddit" },
    { name: "Medium", component: <MediumIcon size={size} />, platform: "medium" },
    { name: "WhatsApp", component: <WhatsAppIcon size={size} />, platform: "whatsapp" },
    { name: "Telegram", component: <TelegramIcon size={size} />, platform: "telegram" },
    { name: "Discord", component: <DiscordIcon size={size} />, platform: "discord" },
    { name: "Globe", component: <GlobeIcon size={size} />, platform: "custom" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Social Icons Demo</h1>
      
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <label htmlFor="size-control" className="text-sm font-medium">Icon Size:</label>
          <input 
            id="size-control"
            type="range" 
            min="16" 
            max="64" 
            value={size} 
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-48"
          />
          <span className="text-sm">{size}px</span>
        </div>
      </div>
      
      <h2 className="text-xl font-semibold mb-3">Direct Component Usage</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 mb-8">
        {socialIcons.map((icon) => (
          <div key={icon.name} className="flex flex-col items-center gap-2 p-4 border rounded-md">
            {icon.component}
            <span className="text-sm">{icon.name}</span>
          </div>
        ))}
      </div>
      
      <h2 className="text-xl font-semibold mb-3">Using SocialIcon Component</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {socialIcons.map((icon) => (
          <div key={icon.name + "-social"} className="flex flex-col items-center gap-2 p-4 border rounded-md">
            <SocialIcon platform={icon.platform} size={size} />
            <span className="text-sm">{icon.name}</span>
          </div>
        ))}
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Icons with Different Sizes</h2>
        <div className="flex items-center flex-wrap gap-4">
          {[16, 20, 24, 32, 40, 48].map((iconSize) => (
            <div key={`fb-${iconSize}`} className="flex items-center border rounded-md p-2">
              <FacebookIcon size={iconSize} />
              <span className="ml-2 text-sm">{iconSize}px</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 
import React from 'react';

export function parseDiscogsLinks(text: string): React.ReactNode[] {
  if (!text) return [text];

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Pattern to match Discogs internal links like [l62008], [a123456], [r789], [m999], [l=Label Name]
  const linkPattern = /\[([alrm])(\d+)\]|\[([alrm])=([^\]]+)\]/g;
  let match;

  while ((match = linkPattern.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const [fullMatch, type1, id1, type2, name] = match;
    
    if (type1 && id1) {
      // Format: [l62008], [a123456], etc.
      const linkType = type1;
      const linkId = id1;
      const url = getDiscogsUrl(linkType, linkId);
      const displayText = fullMatch;
      
      parts.push(
        <a
          key={`${linkType}-${linkId}-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline"
        >
          {displayText}
        </a>
      );
    } else if (type2 && name) {
      // Format: [l=Label Name], [a=Artist Name], etc.
      const linkType = type2;
      const displayName = name;
      // For named links, we can't create a direct URL without the ID, so we'll just style them
      parts.push(
        <span
          key={`${linkType}-${name}-${match.index}`}
          className="text-primary font-medium"
          title={`${getTypeDisplayName(linkType)}: ${displayName}`}
        >
          {displayName}
        </span>
      );
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function getDiscogsUrl(type: string, id: string): string {
  const baseUrl = 'https://www.discogs.com';
  
  switch (type) {
    case 'l':
      return `${baseUrl}/label/${id}`;
    case 'a':
      return `${baseUrl}/artist/${id}`;
    case 'r':
      return `${baseUrl}/release/${id}`;
    case 'm':
      return `${baseUrl}/master/${id}`;
    default:
      return baseUrl;
  }
}

function getTypeDisplayName(type: string): string {
  switch (type) {
    case 'l':
      return 'Label';
    case 'a':
      return 'Artist';
    case 'r':
      return 'Release';
    case 'm':
      return 'Master';
    default:
      return 'Link';
  }
}
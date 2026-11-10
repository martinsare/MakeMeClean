export interface SEOConfig {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

export function updatePageMeta(config: SEOConfig) {
  // Update title
  document.title = config.title;

  // Update or create description meta tag
  let descMeta = document.querySelector('meta[name="description"]');
  if (!descMeta) {
    descMeta = document.createElement('meta');
    descMeta.setAttribute('name', 'description');
    document.head.appendChild(descMeta);
  }
  descMeta.setAttribute('content', config.description);

  // Update Open Graph tags for social sharing
  updateMetaTag('property', 'og:title', config.title);
  updateMetaTag('property', 'og:description', config.description);
  if (config.image) {
    updateMetaTag('property', 'og:image', config.image);
  }
  if (config.url) {
    updateMetaTag('property', 'og:url', config.url);
  }

  // Update Twitter Card tags
  updateMetaTag('name', 'twitter:title', config.title);
  updateMetaTag('name', 'twitter:description', config.description);
  if (config.image) {
    updateMetaTag('name', 'twitter:image', config.image);
  }
}

export function setNoIndex(noIndex: boolean = true) {
  let robotsMeta = document.querySelector('meta[name="robots"]');
  if (noIndex) {
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', 'noindex, nofollow');
  } else if (robotsMeta) {
    robotsMeta.remove();
  }
}

function updateMetaTag(attr: string, value: string, content: string) {
  let tag = document.querySelector(`meta[${attr}="${value}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, value);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

// Default SEO config for different pages
export const seoDefaults = {
  home: {
    title: 'MakeMeClean - Professional Cleaning Services in Wales',
    description: 'Book trusted, insured cleaners across Wales. Same-day available, 7 days a week. Fully vetted and eco-friendly.',
  },
  services: {
    title: 'Cleaning Services - MakeMeClean',
    description: 'Explore our professional cleaning services: standard cleaning, deep clean, Airbnb, end of tenancy, and more.',
  },
  booking: {
    title: 'Book a Clean - MakeMeClean',
    description: 'Book a professional cleaning service in Wales. Simple online booking, flexible scheduling, quality guaranteed.',
  },
  login: {
    title: 'Sign In - MakeMeClean',
    description: 'Sign in to your MakeMeClean account to manage bookings and payments.',
  },
  register: {
    title: 'Create Account - MakeMeClean',
    description: 'Sign up for MakeMeClean and book your first professional cleaning service.',
  },
  faq: {
    title: 'FAQ - MakeMeClean',
    description: 'Answers to common questions about our cleaning services, booking, cancellations, and more.',
  },
  blog: {
    title: 'Blog & Resources - MakeMeClean',
    description: 'Tips, guides, and insights for keeping your home clean and organized.',
  },
  contact: {
    title: 'Contact Us - MakeMeClean',
    description: 'Get in touch with MakeMeClean. Phone, email, or fill out our contact form for support.',
  },
};

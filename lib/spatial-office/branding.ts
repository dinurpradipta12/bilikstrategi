import suppliedLogo from '../../src/logobilik-hitam.png';
import suppliedDarkLogo from '../../src/whitebilik.png';

// The main app's supplied brand assets, with overrides for branded deployments.
export const OFFICE_BRAND = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Bilik Strategi',
  logo: process.env.NEXT_PUBLIC_APP_LOGO || suppliedLogo.src,
  darkLogo: process.env.NEXT_PUBLIC_APP_DARK_LOGO || suppliedDarkLogo.src,
};

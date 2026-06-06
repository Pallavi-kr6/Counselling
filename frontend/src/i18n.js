import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      'app.name': 'Counselling App',
      'nav.home': 'Home',
      'nav.profile': 'Profile',
      'nav.appointments': 'Appointments',
      'nav.mood': 'Mood',
      'nav.resources': 'Resources',
      'nav.emergency': 'Emergency',
      'nav.logout': 'Logout',
      'nav.aiCounselling': 'AI Counselling',
      'nav.voiceRipple': 'Voice Ripple',
      'nav.counsellors': 'Counsellors'
    }
  },
  hi: {
    translation: {
      'app.name': 'काउंसलिंग ऐप',
      'nav.home': 'होम',
      'nav.profile': 'प्रोफ़ाइल',
      'nav.appointments': 'अपॉइंटमेंट',
      'nav.mood': 'मूड',
      'nav.resources': 'संसाधन',
      'nav.emergency': 'आपातकाल',
      'nav.logout': 'लॉगआउट',
      'nav.aiCounselling': 'एआई काउंसलिंग',
      'nav.voiceRipple': 'वॉइस रिपल',
      'nav.counsellors': 'सलाहकार'
    }
  },
  ta: {
    translation: {
      'app.name': 'ஆலோசனை பயன்பாடு',
      'nav.home': 'வீடு',
      'nav.profile': 'சுயவிவரம்',
      'nav.appointments': 'நியமனங்கள்',
      'nav.mood': 'மனநிலை',
      'nav.resources': 'வளங்கள்',
      'nav.emergency': 'அவசர',
      'nav.logout': 'வெளியேறு',
      'nav.aiCounselling': 'ஏஐ ஆலோசனை',
      'nav.voiceRipple': 'குரல் அலை',
      'nav.counsellors': 'ஆலோசகர்கள்'
    }
  },
  te: {
    translation: {
      'app.name': 'కౌన్సెలింగ్ యాప్',
      'nav.home': 'హోమ్',
      'nav.profile': 'ప్రొఫైల్',
      'nav.appointments': 'నియామకాలు',
      'nav.mood': 'మూడ్',
      'nav.resources': 'వనరులు',
      'nav.emergency': 'అత్యవసర',
      'nav.logout': 'లాగ్అవుట్',
      'nav.aiCounselling': 'ఏఐ కౌన్సెలింగ్',
      'nav.voiceRipple': 'వాయిస్ రిపుల్',
      'nav.counsellors': 'కౌన్సిలర్లు'
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

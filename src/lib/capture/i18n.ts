// Guided Field Capture — bilingual dictionary layer (DECISIONS.md D10).
// Not a framework adoption: a small typed catalog scoped to the capture flow.
// Rule (spec 1.1.4): chosen language renders LARGE on top, English small and
// muted below. Taxonomy labels are bilingual at DATA level ({en, hi} JSONB);
// this file only covers the wizard chrome.
//
// TTS: speak() uses the Web Speech API when present (hi-IN voice preferred),
// silently no-ops otherwise — audio is an enhancement, never a dependency.

export type Lang = "hi" | "en";

export const LANG_STORAGE_KEY = "safeops_capture_lang";

const CATALOG = {
  // chrome
  appTitle: { en: "Report a problem", hi: "समस्या बताएँ" },
  back: { en: "Back", hi: "पीछे" },
  next: { en: "Next", hi: "आगे" },
  skip: { en: "Skip", hi: "छोड़ें" },
  submit: { en: "Send report", hi: "रिपोर्ट भेजें" },
  chooseLanguage: { en: "Choose your language", hi: "अपनी भाषा चुनें" },
  goDashboard: { en: "Back to dashboard", hi: "डैशबोर्ड पर वापस" },
  myReports: { en: "My reports", hi: "मेरी रिपोर्टें" },
  newReport: { en: "New report", hi: "नई रिपोर्ट" },
  loading: { en: "Loading…", hi: "लोड हो रहा है…" },
  listen: { en: "Read back to me", hi: "मुझे सुनाओ" },
  more: { en: "More", hi: "और देखें" },
  signOut: { en: "Sign out", hi: "बाहर निकलें" },

  // screen 0 — what do you want to report?
  q_type: { en: "What do you want to report?", hi: "आप क्या बताना चाहते हैं?" },
  type_observation: { en: "Safety observation", hi: "सुरक्षा ऑब्ज़र्वेशन" },
  type_near_miss: { en: "Near-miss", hi: "बाल-बाल बचे" },
  type_unsafe_condition: { en: "Unsafe condition", hi: "खतरनाक हालत" },
  type_incident: { en: "Accident / incident", hi: "दुर्घटना" },
  type_ptw: { en: "Work permit", hi: "वर्क परमिट" },
  type_flra: { en: "Job risk check", hi: "काम से पहले जोखिम जाँच" },
  anonToggle: { en: "Report without my name", hi: "बिना नाम के भेजें" },
  anonOn: { en: "Your name will NOT be sent", hi: "आपका नाम नहीं भेजा जाएगा" },

  // screen 1 — where?
  q_where: { en: "Where did you see it?", hi: "आपने कहाँ देखा?" },
  scanQr: { en: "Scan QR code", hi: "QR कोड स्कैन करें" },
  qrHint: { en: "Fastest way — point camera at the area / machine QR", hi: "सबसे तेज़ — कैमरा QR कोड पर रखें" },
  qrNotFound: { en: "QR not recognised — pick the area instead", hi: "QR नहीं पहचाना — जगह खुद चुनें" },

  // screen 2 — what did you see?
  q_category: { en: "What did you see?", hi: "आपने क्या देखा?" },
  q_category2: { en: "Choose the closest match", hi: "सबसे मिलती-जुलती चीज़ चुनें" },

  // screen 3 — evidence
  q_evidence: { en: "Show us (photo helps a lot)", hi: "हमें दिखाएँ (फोटो से बहुत मदद होती है)" },
  addPhoto: { en: "Take photo", hi: "फोटो खींचें" },
  addFromGallery: { en: "Choose from gallery", hi: "गैलरी से चुनें" },
  addVideo: { en: "Record video", hi: "वीडियो बनाएँ" },
  addVoice: { en: "Speak", hi: "बोलकर बताएँ" },
  evidenceNudge: { en: "A photo helps your safety team act faster", hi: "फोटो से सेफ्टी टीम जल्दी काम कर पाएगी" },
  videoTooLong: { en: "Video must be 30 seconds or less", hi: "वीडियो 30 सेकंड से ज़्यादा न हो" },
  fileTooBig: { en: "File is too big", hi: "फ़ाइल बहुत बड़ी है" },
  remove: { en: "Remove", hi: "हटाएँ" },

  // screen 4 — severity
  q_severity: { en: "How serious is it?", hi: "कितना खतरनाक है?" },
  sev_low: { en: "Could cause minor issue", hi: "छोटी दिक्कत हो सकती है" },
  sev_low_title: { en: "Low", hi: "कम" },
  sev_medium: { en: "Could injure someone", hi: "किसी को चोट लग सकती है" },
  sev_medium_title: { en: "Medium", hi: "मध्यम" },
  sev_high: { en: "Could seriously injure or kill", hi: "जान जा सकती है" },
  sev_high_title: { en: "High", hi: "बहुत ज़्यादा" },

  // screen 5 — voice note
  q_voice: { en: "Anything else? Speak in your language", hi: "कुछ और बताना है? अपनी भाषा में बोलें" },
  tapToRecord: { en: "Tap to speak", hi: "बोलने के लिए दबाएँ" },
  tapToStop: { en: "Tap to stop", hi: "रोकने के लिए दबाएँ" },
  recorded: { en: "Recorded", hi: "रिकॉर्ड हो गया" },
  recordAgain: { en: "Record again", hi: "फिर से बोलें" },
  micDenied: { en: "Microphone not available — you can skip this", hi: "माइक नहीं चल रहा — इसे छोड़ सकते हैं" },
  typeInstead: { en: "Or type it", hi: "या लिखकर बताएँ" },
  describePlaceholder: { en: "Describe what you saw…", hi: "आपने क्या देखा, लिखें…" },

  // AI grammar cleanup (spec §7a — show both, must accept)
  cleanUp: { en: "Tidy up my words", hi: "मेरे शब्द ठीक करें" },
  cleaning: { en: "Tidying up…", hi: "ठीक कर रहे हैं…" },
  aiOriginalLabel: { en: "What you said", hi: "आपने जो कहा" },
  aiCleanedLabel: { en: "Tidied up", hi: "ठीक किया हुआ" },
  useCleaned: { en: "Use this", hi: "यह रखें" },
  keepOriginal: { en: "Keep mine", hi: "मेरा ही रखें" },

  // AI guided draft (guided questions → drafted description)
  helpWrite: { en: "Help me write this", hi: "लिखने में मदद करें" },
  writing: { en: "Writing…", hi: "लिख रहे हैं…" },
  guidedIntro: { en: "Answer a few quick questions and we'll write it for you", hi: "कुछ आसान सवालों के जवाब दें, हम लिख देंगे" },
  guided_what: { en: "What did you see, or what happened?", hi: "आपने क्या देखा, या क्या हुआ?" },
  guided_risk: { en: "What could go wrong?", hi: "क्या नुकसान हो सकता था?" },
  guided_action: { en: "What did you do about it?", hi: "आपने क्या किया?" },
  makeDraft: { en: "Write my report", hi: "मेरी रिपोर्ट लिखें" },
  aiDraftLabel: { en: "Suggested description", hi: "सुझाई गई रिपोर्ट" },
  cancel: { en: "Cancel", hi: "रद्द करें" },

  // asset / context banner + suggested category chip
  assetHere: { en: "at", hi: "पर" },
  suggested: { en: "Suggested", hi: "सुझाव" },
  sameLocation: { en: "Same place", hi: "वही जगह" },

  // flow-specific fields (spec §6 — each report type shows its own details)
  flowObservation: { en: "What kind of observation?", hi: "किस तरह का ऑब्ज़र्वेशन?" },
  obsUnsafeAct: { en: "Unsafe act", hi: "असुरक्षित काम" },
  categoryUnavailable: {
    en: "No categories available offline yet — you can skip this step.",
    hi: "अभी श्रेणियाँ उपलब्ध नहीं हैं — आप यह चरण छोड़ सकते हैं।",
  },
  obsUnsafeCondition: { en: "Unsafe condition", hi: "असुरक्षित हालत" },
  flowNearMiss: { en: "What could have happened?", hi: "क्या हो सकता था?" },
  flowUnsafeCondition: { en: "How long has it been like this?", hi: "यह कब से ऐसा है?" },
  flowIncident: { en: "About the accident", hi: "दुर्घटना के बारे में" },
  immediateActionQ: { en: "What did you do about it? (optional)", hi: "आपने इसके बारे में क्या किया? (ज़रूरी नहीं)" },
  immediateActionPlaceholder: { en: "Action taken on the spot, if any…", hi: "मौके पर क्या किया, अगर कुछ किया हो…" },
  injuryQ: { en: "Was anyone hurt?", hi: "क्या किसी को चोट लगी?" },
  medicalQ: { en: "Did they need medical care?", hi: "क्या इलाज की ज़रूरत पड़ी?" },
  yesLabel: { en: "Yes", hi: "हाँ" },
  noLabel: { en: "No", hi: "नहीं" },
  flowPtw: { en: "Which work permit?", hi: "कौन-सा वर्क परमिट?" },
  flowFlra: { en: "Job hazards", hi: "काम के खतरे" },
  hazardsQ: { en: "Main hazards", hi: "मुख्य खतरे" },
  controlsQ: { en: "Safety controls used", hi: "इस्तेमाल किए बचाव" },

  // screen 6 — review
  q_review: { en: "Check and send", hi: "जाँच कर भेजें" },
  where: { en: "Where", hi: "कहाँ" },
  what: { en: "What", hi: "क्या" },
  noteLabel: { en: "Note", hi: "बात" },
  severity: { en: "How serious", hi: "कितना खतरनाक" },
  evidence: { en: "Evidence", hi: "सबूत" },
  photos: { en: "photo(s)", hi: "फोटो" },
  voiceNote: { en: "voice note", hi: "आवाज़ रिकॉर्डिंग" },
  anonymous: { en: "Anonymous", hi: "बिना नाम" },

  // success / failure
  sending: { en: "Sending…", hi: "भेज रहे हैं…" },
  uploadingMedia: { en: "Uploading photos…", hi: "फोटो भेज रहे हैं…" },
  successTitle: { en: "Report sent!", hi: "रिपोर्ट भेज दी गई!" },
  successBody: { en: "Your safety officer has been notified.", hi: "आपके सेफ्टी अफ़सर को खबर मिल गई है।" },
  refNumber: { en: "Your reference number", hi: "आपका रेफ़रेंस नंबर" },
  another: { en: "Report another", hi: "एक और रिपोर्ट करें" },
  done: { en: "Done", hi: "हो गया" },
  failed: { en: "Could not send. Try again.", hi: "भेज नहीं पाए। फिर कोशिश करें।" },
  offlineSaved: { en: "Saved. Will send when network returns.", hi: "सेव हो गया। नेटवर्क आने पर भेज देंगे।" },

  // my reports
  status_submitted: { en: "Sent", hi: "भेजा गया" },
  status_triaged: { en: "Being reviewed", hi: "जाँच हो रही है" },
  status_converted: { en: "Action started", hi: "कार्रवाई शुरू" },
  status_closed: { en: "Closed", hi: "बंद" },
  status_rejected: { en: "Not accepted", hi: "स्वीकार नहीं हुई" },
  status_queued: { en: "Waiting for network", hi: "नेटवर्क का इंतज़ार" },
  noReports: { en: "No reports yet", hi: "अभी कोई रिपोर्ट नहीं" },
} as const;

export type MsgKey = keyof typeof CATALOG;

export function t(key: MsgKey, lang: Lang): string {
  return CATALOG[key][lang];
}

export function tPair(key: MsgKey, lang: Lang): { primary: string; secondary: string | null } {
  const primary = CATALOG[key][lang];
  const secondary = lang === "en" ? null : CATALOG[key].en;
  return { primary, secondary };
}

/** Bilingual label out of a taxonomy `labels` JSON ({en, hi}). */
export function labelPair(
  labels: Record<string, string> | null | undefined,
  lang: Lang,
): { primary: string; secondary: string | null } {
  const en = labels?.en ?? "";
  const chosen = labels?.[lang] ?? en;
  return { primary: chosen, secondary: lang === "en" || chosen === en ? null : en };
}

export function getStoredLang(): Lang | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LANG_STORAGE_KEY);
  return v === "hi" || v === "en" ? v : null;
}

export function storeLang(lang: Lang) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* storage unavailable (private mode) — session-only language */
  }
}

const LANG_TO_BCP47: Record<Lang, string> = { hi: "hi-IN", en: "en-IN" };

/** Text-to-speech: best-effort, never throws, no-audio fallback (spec Part 3). */
export function speak(text: string, lang: Lang) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_TO_BCP47[lang];
    utterance.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang.toLowerCase().startsWith(LANG_TO_BCP47[lang].toLowerCase()))
      ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang));
    if (match) utterance.voice = match;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* no audio — fine */
  }
}

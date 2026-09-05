// Languages a witness statement can be recorded in.
//
// A statement is only reliable evidence in the language the witness actually
// gave it in, so this list has to cover the languages spoken at the sites in
// the deployment. It previously existed twice — once on the incident report
// form and once on the investigation panel — and the two had drifted: the
// report form offered English, Hindi, Bengali and Khasi only, with no Kannada
// or Tamil, which is what most of the plants here run on. A first responder at
// the Hassan unit therefore had to file every Kannada statement under the
// wrong language, and the investigator's later edit silently disagreed with
// what intake had recorded.
export const WITNESS_LANGUAGES = [
  "English",
  "Hindi",
  "Kannada",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Bengali",
  "Odia",
  "Assamese",
  "Khasi",
  "Other",
] as const;

// The same list in the shape SelectField takes. Derived rather than written out
// again — the drift described above is exactly what a second hand-written copy
// caused, and the intake form and the investigation panel both read this now.
export const WITNESS_LANGUAGE_OPTIONS = WITNESS_LANGUAGES.map((l) => ({ value: l, label: l }));

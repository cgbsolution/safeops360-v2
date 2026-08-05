/**
 * Seed data for the Guided Field Capture module (SafeOps360).
 *
 * Pure data module — no imports, no side effects. Consumed by the Prisma seed
 * script that materializes the Hazard Taxonomy, Cause Library (6-M fishbone)
 * and Control Library for the Meridian Manufacturing demo tenant
 * (apparel/garment factories: cutting, sewing, finishing & packing,
 * boiler house, warehouse, compressor house).
 *
 * Bilingual at the data level: every node carries an English label and a
 * natural spoken-Hindi label (Devanagari) that a factory worker understands.
 * `iconKey` values are lucide-react icon names in kebab-case.
 */

export type TaxonomyNodeSeed = {
  code: string; // stable snake_case key, unique within its kind
  labels: { en: string; hi: string }; // hi = natural Devanagari Hindi
  iconKey: string; // lucide-react icon name in kebab-case
  fishboneCategory?:
    | "EQUIPMENT"
    | "PERSON"
    | "PROCESS"
    | "ENVIRONMENT"
    | "MATERIAL"
    | "MANAGEMENT"; // CAUSE/CONTROL nodes only
  sortWeight: number; // display order within siblings
  children?: TaxonomyNodeSeed[];
};

// ---------------------------------------------------------------------------
// 1. HAZARD TAXONOMY — 12 ISO-7010-style categories, garment-manufacturing L2s
// ---------------------------------------------------------------------------

export const HAZARD_TAXONOMY: TaxonomyNodeSeed[] = [
  {
    code: "slip_trip_fall",
    labels: { en: "Slip, trip & fall", hi: "फिसलने-गिरने का खतरा" },
    iconKey: "footprints",
    sortWeight: 0,
    children: [
      {
        code: "slip_trip_fall.wet_floor",
        labels: { en: "Wet or oily floor", hi: "गीला या तेल लगा फर्श" },
        iconKey: "droplets",
        sortWeight: 0,
      },
      {
        code: "slip_trip_fall.cables_walkway",
        labels: {
          en: "Cables or hoses across walkway",
          hi: "रास्ते में तार या पाइप फैले हैं",
        },
        iconKey: "cable",
        sortWeight: 1,
      },
      {
        code: "slip_trip_fall.uneven_surface",
        labels: { en: "Broken or uneven floor", hi: "टूटा या ऊँचा-नीचा फर्श" },
        iconKey: "alert-triangle",
        sortWeight: 2,
      },
      {
        code: "slip_trip_fall.fabric_scraps",
        labels: {
          en: "Fabric scraps / poly bags on floor",
          hi: "फर्श पर कतरन या पॉलीथिन",
        },
        iconKey: "layers",
        sortWeight: 3,
      },
      {
        code: "slip_trip_fall.poor_lighting",
        labels: { en: "Dark stairway or aisle", hi: "सीढ़ी या रास्ते में अंधेरा" },
        iconKey: "lightbulb",
        sortWeight: 4,
      },
      {
        code: "slip_trip_fall.stair_handrail",
        labels: {
          en: "Stair handrail missing or broken",
          hi: "सीढ़ी की रेलिंग टूटी या नहीं है",
        },
        iconKey: "construction",
        sortWeight: 5,
      },
    ],
  },
  {
    code: "fire",
    labels: { en: "Fire", hi: "आग का खतरा" },
    iconKey: "flame",
    sortWeight: 1,
    children: [
      {
        code: "fire.lint_accumulation",
        labels: {
          en: "Fabric dust / lint near motors",
          hi: "मोटर के पास रुई-धूल जमा है",
        },
        iconKey: "haze",
        sortWeight: 0,
      },
      {
        code: "fire.boiler_steam_leak",
        labels: { en: "Boiler steam or fuel leak", hi: "बॉयलर से भाप या तेल लीक" },
        iconKey: "factory",
        sortWeight: 1,
      },
      {
        code: "fire.gas_leak_iron",
        labels: { en: "LPG leak at ironing table", hi: "प्रेस टेबल पर गैस लीक" },
        iconKey: "wind",
        sortWeight: 2,
      },
      {
        code: "fire.blocked_exit",
        labels: { en: "Blocked fire exit", hi: "फायर एग्ज़िट का रास्ता बंद" },
        iconKey: "door-closed",
        sortWeight: 3,
      },
      {
        code: "fire.panel_heat",
        labels: {
          en: "Heat / burning smell from electrical panel",
          hi: "पैनल से गर्मी या जलने की बदबू",
        },
        iconKey: "zap",
        sortWeight: 4,
      },
      {
        code: "fire.extinguisher_issue",
        labels: {
          en: "Extinguisher missing, expired or blocked",
          hi: "फायर सिलेंडर नहीं या खराब है",
        },
        iconKey: "fire-extinguisher",
        sortWeight: 5,
      },
    ],
  },
  {
    code: "electrical",
    labels: { en: "Electrical", hi: "बिजली का खतरा" },
    iconKey: "zap",
    sortWeight: 2,
    children: [
      {
        code: "electrical.exposed_wiring",
        labels: { en: "Exposed or damaged wiring", hi: "खुले या कटे-फटे तार" },
        iconKey: "cable",
        sortWeight: 0,
      },
      {
        code: "electrical.broken_socket",
        labels: { en: "Broken switch or socket", hi: "टूटा स्विच या सॉकेट" },
        iconKey: "plug",
        sortWeight: 1,
      },
      {
        code: "electrical.overloaded_board",
        labels: {
          en: "Overloaded extension board",
          hi: "एक बोर्ड में बहुत सारे प्लग",
        },
        iconKey: "plug-zap",
        sortWeight: 2,
      },
      {
        code: "electrical.no_earthing",
        labels: { en: "Machine earthing missing", hi: "मशीन की अर्थिंग नहीं है" },
        iconKey: "zap-off",
        sortWeight: 3,
      },
      {
        code: "electrical.panel_open",
        labels: { en: "Electrical panel left open", hi: "बिजली का पैनल खुला है" },
        iconKey: "door-open",
        sortWeight: 4,
      },
      {
        code: "electrical.wet_equipment",
        labels: {
          en: "Water near electrical equipment",
          hi: "बिजली के पास पानी या गीलापन",
        },
        iconKey: "droplets",
        sortWeight: 5,
      },
    ],
  },
  {
    code: "chemical",
    labels: { en: "Chemical", hi: "केमिकल का खतरा" },
    iconKey: "flask-conical",
    sortWeight: 3,
    children: [
      {
        code: "chemical.unlabelled_container",
        labels: {
          en: "Unlabelled chemical container",
          hi: "डिब्बे पर लेबल नहीं है",
        },
        iconKey: "flask-round",
        sortWeight: 0,
      },
      {
        code: "chemical.spot_cleaning_fumes",
        labels: {
          en: "Spot-cleaning solvent fumes",
          hi: "स्पॉटिंग केमिकल की तेज़ बदबू",
        },
        iconKey: "wind",
        sortWeight: 1,
      },
      {
        code: "chemical.spill",
        labels: { en: "Chemical spilled on floor", hi: "फर्श पर केमिकल गिरा है" },
        iconKey: "droplets",
        sortWeight: 2,
      },
      {
        code: "chemical.improper_storage",
        labels: {
          en: "Chemicals stored near heat or food",
          hi: "केमिकल गलत जगह रखा है",
        },
        iconKey: "archive",
        sortWeight: 3,
      },
      {
        code: "chemical.no_msds",
        labels: {
          en: "Safety data sheet (MSDS) not available",
          hi: "केमिकल की जानकारी (MSDS) नहीं",
        },
        iconKey: "file-text",
        sortWeight: 4,
      },
      {
        code: "chemical.skin_contact",
        labels: {
          en: "Handling chemicals without gloves",
          hi: "बिना दस्ताने केमिकल का काम",
        },
        iconKey: "hand",
        sortWeight: 5,
      },
    ],
  },
  {
    code: "machine_guarding",
    labels: { en: "Machine guarding", hi: "मशीन का गार्ड" },
    iconKey: "cog",
    sortWeight: 4,
    children: [
      {
        code: "machine_guarding.needle_guard",
        labels: {
          en: "Needle guard missing on sewing machine",
          hi: "सिलाई मशीन पर नीडल गार्ड नहीं",
        },
        iconKey: "shield",
        sortWeight: 0,
      },
      {
        code: "machine_guarding.cutter_blade",
        labels: {
          en: "Cutting machine blade exposed",
          hi: "कटिंग मशीन का ब्लेड खुला है",
        },
        iconKey: "scissors",
        sortWeight: 1,
      },
      {
        code: "machine_guarding.pulley_belt",
        labels: {
          en: "Overlock pulley / belt unguarded",
          hi: "बेल्ट-पुली पर कवर नहीं है",
        },
        iconKey: "cog",
        sortWeight: 2,
      },
      {
        code: "machine_guarding.eye_guard",
        labels: {
          en: "Eye guard missing or broken",
          hi: "आँख वाला गार्ड टूटा या नहीं है",
        },
        iconKey: "eye",
        sortWeight: 3,
      },
      {
        code: "machine_guarding.emergency_stop",
        labels: {
          en: "Emergency stop not working",
          hi: "इमरजेंसी स्टॉप बटन खराब है",
        },
        iconKey: "power",
        sortWeight: 4,
      },
      {
        code: "machine_guarding.interlock_bypassed",
        labels: {
          en: "Guard removed or interlock bypassed",
          hi: "गार्ड हटाकर मशीन चलाना",
        },
        iconKey: "unlock",
        sortWeight: 5,
      },
    ],
  },
  {
    code: "housekeeping",
    labels: { en: "Housekeeping", hi: "साफ़-सफ़ाई" },
    iconKey: "brush",
    sortWeight: 5,
    children: [
      {
        code: "housekeeping.aisle_blocked",
        labels: {
          en: "Aisle blocked with material",
          hi: "रास्ते में सामान रखा है",
        },
        iconKey: "box",
        sortWeight: 0,
      },
      {
        code: "housekeeping.waste_overflow",
        labels: {
          en: "Waste piled up / bins overflowing",
          hi: "कचरा फैला है, डस्टबिन भरा",
        },
        iconKey: "trash-2",
        sortWeight: 1,
      },
      {
        code: "housekeeping.material_stacking",
        labels: {
          en: "Material scattered / messy stacking",
          hi: "सामान इधर-उधर बिखरा है",
        },
        iconKey: "layers",
        sortWeight: 2,
      },
      {
        code: "housekeeping.spillage_not_cleaned",
        labels: {
          en: "Spill not cleaned promptly",
          hi: "गिरा तेल-पानी साफ नहीं हुआ",
        },
        iconKey: "droplets",
        sortWeight: 3,
      },
      {
        code: "housekeeping.tools_lying",
        labels: {
          en: "Tools / trolleys left in work area",
          hi: "औज़ार और ट्रॉली इधर-उधर पड़े",
        },
        iconKey: "wrench",
        sortWeight: 4,
      },
    ],
  },
  {
    code: "ppe",
    labels: { en: "PPE", hi: "सेफ्टी का सामान (PPE)" },
    iconKey: "hard-hat",
    sortWeight: 6,
    children: [
      {
        code: "ppe.no_mask",
        labels: {
          en: "No dust mask in dusty area",
          hi: "धूल में मास्क नहीं पहना",
        },
        iconKey: "haze",
        sortWeight: 0,
      },
      {
        code: "ppe.no_metal_glove",
        labels: {
          en: "No metal mesh glove on cutting machine",
          hi: "कटिंग में लोहे का दस्ताना नहीं",
        },
        iconKey: "hand",
        sortWeight: 1,
      },
      {
        code: "ppe.no_ear_protection",
        labels: {
          en: "No ear plugs near generator / compressor",
          hi: "कान में प्लग नहीं लगाया",
        },
        iconKey: "ear",
        sortWeight: 2,
      },
      {
        code: "ppe.no_safety_shoes",
        labels: {
          en: "No safety shoes in warehouse / boiler area",
          hi: "सेफ्टी जूते नहीं पहने",
        },
        iconKey: "footprints",
        sortWeight: 3,
      },
      {
        code: "ppe.no_eye_protection",
        labels: {
          en: "No goggles during grinding / boiler work",
          hi: "आँखों पर चश्मा नहीं लगाया",
        },
        iconKey: "glasses",
        sortWeight: 4,
      },
      {
        code: "ppe.damaged_ppe",
        labels: {
          en: "Torn or damaged PPE in use",
          hi: "फटा-पुराना PPE चल रहा है",
        },
        iconKey: "shield-alert",
        sortWeight: 5,
      },
    ],
  },
  {
    code: "ergonomics",
    labels: { en: "Ergonomics", hi: "काम में शरीर पर जोर" },
    iconKey: "person-standing",
    sortWeight: 7,
    children: [
      {
        code: "ergonomics.prolonged_sitting",
        labels: {
          en: "Sitting long hours at sewing machine",
          hi: "घंटों एक जगह बैठे रहना",
        },
        iconKey: "timer",
        sortWeight: 0,
      },
      {
        code: "ergonomics.bad_chair",
        labels: {
          en: "Broken or wrong-height chair / stool",
          hi: "टूटी या ऊँची-नीची कुर्सी",
        },
        iconKey: "armchair",
        sortWeight: 1,
      },
      {
        code: "ergonomics.repetitive_motion",
        labels: {
          en: "Same hand movement all day",
          hi: "दिन भर एक जैसा हाथ चलाना",
        },
        iconKey: "repeat",
        sortWeight: 2,
      },
      {
        code: "ergonomics.bending_reaching",
        labels: {
          en: "Frequent bending or overreaching",
          hi: "बार-बार झुककर काम करना",
        },
        iconKey: "move-down",
        sortWeight: 3,
      },
      {
        code: "ergonomics.standing_long",
        labels: {
          en: "Standing whole shift (ironing / packing)",
          hi: "पूरी शिफ्ट खड़े रहना",
        },
        iconKey: "person-standing",
        sortWeight: 4,
      },
      {
        code: "ergonomics.heavy_lifting_posture",
        labels: {
          en: "Lifting heavy rolls with bent back",
          hi: "झुककर भारी वजन उठाना",
        },
        iconKey: "weight",
        sortWeight: 5,
      },
    ],
  },
  {
    code: "vehicle_forklift",
    labels: { en: "Vehicles & forklift", hi: "गाड़ी / फोर्कलिफ्ट" },
    iconKey: "truck",
    sortWeight: 8,
    children: [
      {
        code: "vehicle_forklift.speeding",
        labels: {
          en: "Forklift speeding indoors",
          hi: "फोर्कलिफ्ट अंदर तेज़ चलती है",
        },
        iconKey: "gauge",
        sortWeight: 0,
      },
      {
        code: "vehicle_forklift.no_horn_lights",
        labels: {
          en: "Horn / lights / beeper not working",
          hi: "हॉर्न या लाइट काम नहीं करती",
        },
        iconKey: "bell",
        sortWeight: 1,
      },
      {
        code: "vehicle_forklift.pedestrian_mix",
        labels: {
          en: "No separate pedestrian walkway",
          hi: "पैदल चलने का अलग रास्ता नहीं",
        },
        iconKey: "footprints",
        sortWeight: 2,
      },
      {
        code: "vehicle_forklift.unsecured_load",
        labels: {
          en: "Unstable or overhanging load",
          hi: "लोड ढीला या टेढ़ा लदा है",
        },
        iconKey: "package",
        sortWeight: 3,
      },
      {
        code: "vehicle_forklift.untrained_driver",
        labels: {
          en: "Driver without training / licence",
          hi: "ड्राइवर बिना ट्रेनिंग-लाइसेंस",
        },
        iconKey: "user-x",
        sortWeight: 4,
      },
      {
        code: "vehicle_forklift.dock_parking",
        labels: {
          en: "Truck not chocked at loading dock",
          hi: "डॉक पर ट्रक का पहिया नहीं रोका",
        },
        iconKey: "truck",
        sortWeight: 5,
      },
    ],
  },
  {
    code: "working_at_height",
    labels: { en: "Working at height", hi: "ऊँचाई पर काम" },
    iconKey: "construction",
    sortWeight: 9,
    children: [
      {
        code: "working_at_height.no_harness",
        labels: {
          en: "No safety belt / harness",
          hi: "सेफ्टी बेल्ट नहीं पहनी",
        },
        iconKey: "shield-check",
        sortWeight: 0,
      },
      {
        code: "working_at_height.damaged_ladder",
        labels: { en: "Broken or shaky ladder", hi: "टूटी या हिलती सीढ़ी" },
        iconKey: "alert-triangle",
        sortWeight: 1,
      },
      {
        code: "working_at_height.fragile_roof",
        labels: {
          en: "Working on fragile roof sheet",
          hi: "कमज़ोर छत पर चढ़ना",
        },
        iconKey: "home",
        sortWeight: 2,
      },
      {
        code: "working_at_height.no_barricade",
        labels: {
          en: "No barricade below work area",
          hi: "नीचे घेराबंदी नहीं की",
        },
        iconKey: "fence",
        sortWeight: 3,
      },
      {
        code: "working_at_height.improper_scaffold",
        labels: {
          en: "Unsafe or incomplete scaffolding",
          hi: "मचान ठीक से नहीं बना",
        },
        iconKey: "construction",
        sortWeight: 4,
      },
    ],
  },
  {
    code: "confined_space",
    labels: { en: "Confined space", hi: "बंद / तंग जगह" },
    iconKey: "door-closed",
    sortWeight: 10,
    children: [
      {
        code: "confined_space.no_permit",
        labels: { en: "Entry without permit", hi: "बिना परमिट अंदर घुसना" },
        iconKey: "clipboard-list",
        sortWeight: 0,
      },
      {
        code: "confined_space.no_gas_test",
        labels: {
          en: "No gas / air test before entry",
          hi: "पहले हवा-गैस की जांच नहीं",
        },
        iconKey: "gauge",
        sortWeight: 1,
      },
      {
        code: "confined_space.no_attendant",
        labels: {
          en: "No attendant standing outside",
          hi: "बाहर कोई निगरानी वाला नहीं",
        },
        iconKey: "users",
        sortWeight: 2,
      },
      {
        code: "confined_space.poor_ventilation",
        labels: {
          en: "No ventilation in tank / pit",
          hi: "टैंक-गड्ढे में हवा नहीं आती",
        },
        iconKey: "fan",
        sortWeight: 3,
      },
      {
        code: "confined_space.no_rescue_plan",
        labels: {
          en: "No rescue arrangement ready",
          hi: "बचाव का कोई इंतज़ाम नहीं",
        },
        iconKey: "life-buoy",
        sortWeight: 4,
      },
    ],
  },
  {
    code: "material_handling",
    labels: { en: "Material handling", hi: "सामान उठाना-रखना" },
    iconKey: "package",
    sortWeight: 11,
    children: [
      {
        code: "material_handling.heavy_manual_lift",
        labels: {
          en: "Lifting heavy fabric rolls alone",
          hi: "अकेले भारी रोल उठाना",
        },
        iconKey: "weight",
        sortWeight: 0,
      },
      {
        code: "material_handling.unstable_stack",
        labels: {
          en: "Cartons stacked too high / unstable",
          hi: "डिब्बे बहुत ऊँचे लदे हैं",
        },
        iconKey: "boxes",
        sortWeight: 1,
      },
      {
        code: "material_handling.sharp_edges",
        labels: {
          en: "Sharp edges / nails on trolleys, pallets",
          hi: "ट्रॉली-पैलेट में नुकीली कीलें",
        },
        iconKey: "alert-triangle",
        sortWeight: 2,
      },
      {
        code: "material_handling.overloaded_trolley",
        labels: {
          en: "Overloaded or faulty trolley",
          hi: "ट्रॉली पर ज़्यादा माल लदा",
        },
        iconKey: "shopping-cart",
        sortWeight: 3,
      },
      {
        code: "material_handling.rack_damage",
        labels: {
          en: "Damaged or overloaded storage rack",
          hi: "रैक टूटा या ज़्यादा भरा है",
        },
        iconKey: "layers",
        sortWeight: 4,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. CAUSE LIBRARY — 6-M fishbone, 3 levels deep, apparel-manufacturing causes
//    fishboneCategory is set on EVERY node of each bone's subtree.
// ---------------------------------------------------------------------------

export const CAUSE_LIBRARY: TaxonomyNodeSeed[] = [
  {
    code: "cause_equipment",
    labels: { en: "Equipment / machine", hi: "मशीन / औज़ार" },
    iconKey: "wrench",
    fishboneCategory: "EQUIPMENT",
    sortWeight: 0,
    children: [
      {
        code: "cause_equipment.not_maintained",
        labels: { en: "Not maintained", hi: "मशीन की देखभाल नहीं हुई" },
        iconKey: "wrench",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 0,
        children: [
          {
            code: "cause_equipment.not_maintained.pm_skipped",
            labels: { en: "PM schedule skipped", hi: "मेंटेनेंस का शेड्यूल छूट गया" },
            iconKey: "calendar",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 0,
          },
          {
            code: "cause_equipment.not_maintained.no_mechanic",
            labels: {
              en: "No mechanic available on shift",
              hi: "शिफ्ट में मैकेनिक नहीं था",
            },
            iconKey: "user-x",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 1,
          },
          {
            code: "cause_equipment.not_maintained.temporary_repair",
            labels: {
              en: "Breakdown repaired temporarily",
              hi: "काम-चलाऊ जुगाड़ से मरम्मत की",
            },
            iconKey: "hammer",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_equipment.guard_missing",
        labels: { en: "Guard missing / removed", hi: "गार्ड नहीं था या हटा दिया" },
        iconKey: "shield",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 1,
        children: [
          {
            code: "cause_equipment.guard_missing.removed_for_speed",
            labels: {
              en: "Removed to work faster",
              hi: "जल्दी काम के लिए गार्ड हटाया",
            },
            iconKey: "fast-forward",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 0,
          },
          {
            code: "cause_equipment.guard_missing.broken_not_replaced",
            labels: {
              en: "Broken and never replaced",
              hi: "टूटा गार्ड बदला नहीं गया",
            },
            iconKey: "shield-alert",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 1,
          },
          {
            code: "cause_equipment.guard_missing.machine_no_guard",
            labels: {
              en: "Machine supplied without guard",
              hi: "मशीन में गार्ड आया ही नहीं",
            },
            iconKey: "shield-off",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_equipment.wrong_tool",
        labels: { en: "Wrong tool / machine for job", hi: "काम के लिए गलत औज़ार" },
        iconKey: "hammer",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 2,
        children: [
          {
            code: "cause_equipment.wrong_tool.correct_unavailable",
            labels: { en: "Right tool not available", hi: "सही औज़ार मिला ही नहीं" },
            iconKey: "search",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 0,
          },
          {
            code: "cause_equipment.wrong_tool.improvised",
            labels: {
              en: "Improvised tool made on the spot",
              hi: "खुद का बनाया जुगाड़ू औज़ार",
            },
            iconKey: "wrench",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 1,
          },
          {
            code: "cause_equipment.wrong_tool.capacity_exceeded",
            labels: {
              en: "Machine used beyond capacity",
              hi: "मशीन से क्षमता से ज़्यादा काम",
            },
            iconKey: "gauge",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_equipment.worn_out",
        labels: { en: "Worn out / aged", hi: "पुरानी या घिसी हुई मशीन" },
        iconKey: "clock",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 3,
        children: [
          {
            code: "cause_equipment.worn_out.blade_dull",
            labels: {
              en: "Blade or needle dull / bent",
              hi: "ब्लेड या सुई घिसी-मुड़ी है",
            },
            iconKey: "scissors",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 0,
          },
          {
            code: "cause_equipment.worn_out.wiring_aged",
            labels: {
              en: "Old wiring, insulation cracked",
              hi: "पुराने तार, इंसुलेशन फटा",
            },
            iconKey: "cable",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 1,
          },
          {
            code: "cause_equipment.worn_out.parts_loose",
            labels: {
              en: "Parts loose, machine vibrating",
              hi: "पुर्ज़े ढीले, मशीन हिलती है",
            },
            iconKey: "cog",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_equipment.no_spares",
        labels: { en: "No spare parts", hi: "स्पेयर पार्ट नहीं मिलते" },
        iconKey: "package",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 4,
        children: [
          {
            code: "cause_equipment.no_spares.not_stocked",
            labels: { en: "Spare not in store", hi: "स्टोर में पार्ट नहीं था" },
            iconKey: "archive",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 0,
          },
          {
            code: "cause_equipment.no_spares.cheap_substitute",
            labels: {
              en: "Cheap local part fitted",
              hi: "सस्ता लोकल पार्ट लगा दिया",
            },
            iconKey: "thumbs-down",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 1,
          },
          {
            code: "cause_equipment.no_spares.long_procurement",
            labels: {
              en: "Purchase takes too long",
              hi: "पार्ट मंगाने में बहुत समय लगता",
            },
            iconKey: "clock",
            fishboneCategory: "EQUIPMENT",
            sortWeight: 2,
          },
        ],
      },
    ],
  },
  {
    code: "cause_person",
    labels: { en: "Person", hi: "काम करने वाला व्यक्ति" },
    iconKey: "users",
    fishboneCategory: "PERSON",
    sortWeight: 1,
    children: [
      {
        code: "cause_person.not_trained",
        labels: { en: "Not trained", hi: "ट्रेनिंग नहीं मिली" },
        iconKey: "graduation-cap",
        fishboneCategory: "PERSON",
        sortWeight: 0,
        children: [
          {
            code: "cause_person.not_trained.new_joiner",
            labels: {
              en: "New worker, no induction",
              hi: "नया वर्कर, बिना ट्रेनिंग काम पर",
            },
            iconKey: "user-x",
            fishboneCategory: "PERSON",
            sortWeight: 0,
          },
          {
            code: "cause_person.not_trained.refresher_missed",
            labels: {
              en: "Refresher training missed",
              hi: "दोबारा ट्रेनिंग नहीं हुई",
            },
            iconKey: "repeat",
            fishboneCategory: "PERSON",
            sortWeight: 1,
          },
          {
            code: "cause_person.not_trained.different_machine",
            labels: {
              en: "Trained on a different machine",
              hi: "दूसरी मशीन की ट्रेनिंग थी",
            },
            iconKey: "replace",
            fishboneCategory: "PERSON",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_person.shortcut_taken",
        labels: { en: "Shortcut / hurry", hi: "जल्दबाज़ी में शॉर्टकट लिया" },
        iconKey: "fast-forward",
        fishboneCategory: "PERSON",
        sortWeight: 1,
        children: [
          {
            code: "cause_person.shortcut_taken.production_target",
            labels: {
              en: "Rushing for production target",
              hi: "टारगेट पूरा करने की जल्दी",
            },
            iconKey: "trending-up",
            fishboneCategory: "PERSON",
            sortWeight: 0,
          },
          {
            code: "cause_person.shortcut_taken.skipped_steps",
            labels: { en: "Safety steps skipped", hi: "सेफ्टी के स्टेप छोड़ दिए" },
            iconKey: "list-checks",
            fishboneCategory: "PERSON",
            sortWeight: 1,
          },
          {
            code: "cause_person.shortcut_taken.overtime_rush",
            labels: {
              en: "Hurrying to finish overtime",
              hi: "ओवरटाइम जल्दी खत्म करने की हड़बड़ी",
            },
            iconKey: "timer",
            fishboneCategory: "PERSON",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_person.fatigue",
        labels: { en: "Tired / unwell", hi: "थकान या तबीयत खराब" },
        iconKey: "battery-low",
        fishboneCategory: "PERSON",
        sortWeight: 2,
        children: [
          {
            code: "cause_person.fatigue.long_overtime",
            labels: { en: "Long overtime hours", hi: "लगातार लंबा ओवरटाइम" },
            iconKey: "clock",
            fishboneCategory: "PERSON",
            sortWeight: 0,
          },
          {
            code: "cause_person.fatigue.night_shift",
            labels: { en: "Night-shift drowsiness", hi: "रात की शिफ्ट में नींद आना" },
            iconKey: "moon",
            fishboneCategory: "PERSON",
            sortWeight: 1,
          },
          {
            code: "cause_person.fatigue.worked_while_unwell",
            labels: {
              en: "Unwell but kept working",
              hi: "तबीयत खराब फिर भी काम किया",
            },
            iconKey: "heart-pulse",
            fishboneCategory: "PERSON",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_person.unaware_of_risk",
        labels: { en: "Did not know the risk", hi: "खतरे का पता नहीं था" },
        iconKey: "eye-off",
        fishboneCategory: "PERSON",
        sortWeight: 3,
        children: [
          {
            code: "cause_person.unaware_of_risk.hazard_not_told",
            labels: {
              en: "Hazard never explained",
              hi: "खतरा किसी ने बताया नहीं",
            },
            iconKey: "message-square",
            fishboneCategory: "PERSON",
            sortWeight: 0,
          },
          {
            code: "cause_person.unaware_of_risk.signage_not_understood",
            labels: {
              en: "Could not read the signage",
              hi: "बोर्ड-साइन समझ नहीं आया",
            },
            iconKey: "signpost",
            fishboneCategory: "PERSON",
            sortWeight: 1,
          },
          {
            code: "cause_person.unaware_of_risk.assumed_safe",
            labels: { en: "Thought it was safe", hi: "लगा कि कोई खतरा नहीं है" },
            iconKey: "shield-check",
            fishboneCategory: "PERSON",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_person.ppe_not_used",
        labels: { en: "PPE not used properly", hi: "PPE नहीं पहना या गलत पहना" },
        iconKey: "hard-hat",
        fishboneCategory: "PERSON",
        sortWeight: 4,
        children: [
          {
            code: "cause_person.ppe_not_used.uncomfortable",
            labels: {
              en: "PPE uncomfortable in heat",
              hi: "गर्मी में PPE पहनना मुश्किल",
            },
            iconKey: "thermometer",
            fishboneCategory: "PERSON",
            sortWeight: 0,
          },
          {
            code: "cause_person.ppe_not_used.not_issued",
            labels: {
              en: "PPE not issued or wrong size",
              hi: "PPE मिला नहीं या साइज़ गलत",
            },
            iconKey: "package",
            fishboneCategory: "PERSON",
            sortWeight: 1,
          },
          {
            code: "cause_person.ppe_not_used.habit_not_formed",
            labels: { en: "Not in the habit", hi: "पहनने की आदत नहीं बनी" },
            iconKey: "repeat",
            fishboneCategory: "PERSON",
            sortWeight: 2,
          },
        ],
      },
    ],
  },
  {
    code: "cause_process",
    labels: { en: "Process / method", hi: "काम का तरीका" },
    iconKey: "clipboard-list",
    fishboneCategory: "PROCESS",
    sortWeight: 2,
    children: [
      {
        code: "cause_process.no_sop",
        labels: { en: "No procedure / SOP", hi: "काम का लिखा तरीका (SOP) नहीं" },
        iconKey: "file-text",
        fishboneCategory: "PROCESS",
        sortWeight: 0,
        children: [
          {
            code: "cause_process.no_sop.never_written",
            labels: { en: "SOP never written", hi: "SOP कभी बनाई ही नहीं" },
            iconKey: "file-text",
            fishboneCategory: "PROCESS",
            sortWeight: 0,
          },
          {
            code: "cause_process.no_sop.outdated",
            labels: {
              en: "SOP old, machine has changed",
              hi: "SOP पुरानी, मशीन बदल गई",
            },
            iconKey: "history",
            fishboneCategory: "PROCESS",
            sortWeight: 1,
          },
          {
            code: "cause_process.no_sop.not_local_language",
            labels: {
              en: "SOP not in worker's language",
              hi: "SOP हिंदी-लोकल भाषा में नहीं",
            },
            iconKey: "languages",
            fishboneCategory: "PROCESS",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_process.unclear_instructions",
        labels: { en: "Unclear instructions", hi: "काम ठीक से समझाया नहीं" },
        iconKey: "message-square",
        fishboneCategory: "PROCESS",
        sortWeight: 1,
        children: [
          {
            code: "cause_process.unclear_instructions.verbal_only",
            labels: {
              en: "Only verbal, nothing written",
              hi: "सिर्फ मुँह-ज़बानी बताया",
            },
            iconKey: "megaphone",
            fishboneCategory: "PROCESS",
            sortWeight: 0,
          },
          {
            code: "cause_process.unclear_instructions.conflicting_orders",
            labels: {
              en: "Supervisors gave conflicting orders",
              hi: "दो सुपरवाइज़र ने अलग-अलग बोला",
            },
            iconKey: "users",
            fishboneCategory: "PROCESS",
            sortWeight: 1,
          },
          {
            code: "cause_process.unclear_instructions.style_change_not_briefed",
            labels: {
              en: "New style change not briefed",
              hi: "नया स्टाइल समझाया नहीं गया",
            },
            iconKey: "shirt",
            fishboneCategory: "PROCESS",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_process.permit_not_followed",
        labels: {
          en: "Permit / checklist not followed",
          hi: "परमिट या चेकलिस्ट नहीं भरी",
        },
        iconKey: "clipboard-list",
        fishboneCategory: "PROCESS",
        sortWeight: 2,
        children: [
          {
            code: "cause_process.permit_not_followed.permit_skipped",
            labels: {
              en: "Permit skipped to save time",
              hi: "समय बचाने को परमिट छोड़ा",
            },
            iconKey: "fast-forward",
            fishboneCategory: "PROCESS",
            sortWeight: 0,
          },
          {
            code: "cause_process.permit_not_followed.ticked_without_checking",
            labels: {
              en: "Checklist ticked without checking",
              hi: "बिना देखे टिक मार दिया",
            },
            iconKey: "list-checks",
            fishboneCategory: "PROCESS",
            sortWeight: 1,
          },
          {
            code: "cause_process.permit_not_followed.no_loto",
            labels: {
              en: "Machine not locked out (LOTO)",
              hi: "मशीन बंद कर लॉक नहीं किया",
            },
            iconKey: "lock",
            fishboneCategory: "PROCESS",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_process.bad_layout",
        labels: { en: "Bad layout / congestion", hi: "जगह की तंगी और भीड़" },
        iconKey: "layout-grid",
        fishboneCategory: "PROCESS",
        sortWeight: 3,
        children: [
          {
            code: "cause_process.bad_layout.machines_too_close",
            labels: {
              en: "Machines placed too close",
              hi: "मशीनें बहुत पास-पास लगी हैं",
            },
            iconKey: "cog",
            fishboneCategory: "PROCESS",
            sortWeight: 0,
          },
          {
            code: "cause_process.bad_layout.no_marked_walkway",
            labels: { en: "No marked walkway", hi: "चलने का रास्ता बना नहीं" },
            iconKey: "footprints",
            fishboneCategory: "PROCESS",
            sortWeight: 1,
          },
          {
            code: "cause_process.bad_layout.material_flow_crossing",
            labels: {
              en: "Material path crosses work area",
              hi: "माल का रास्ता काम के बीच से",
            },
            iconKey: "shuffle",
            fishboneCategory: "PROCESS",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_process.change_not_managed",
        labels: { en: "Change made without assessment", hi: "बदलाव बिना सोचे किया" },
        iconKey: "refresh-cw",
        fishboneCategory: "PROCESS",
        sortWeight: 4,
        children: [
          {
            code: "cause_process.change_not_managed.new_chemical_no_check",
            labels: {
              en: "New chemical brought without check",
              hi: "नया केमिकल बिना जांच लाए",
            },
            iconKey: "flask-conical",
            fishboneCategory: "PROCESS",
            sortWeight: 0,
          },
          {
            code: "cause_process.change_not_managed.layout_changed_overnight",
            labels: {
              en: "Line layout changed without review",
              hi: "रातों-रात लाइन बदल दी",
            },
            iconKey: "layout-grid",
            fishboneCategory: "PROCESS",
            sortWeight: 1,
          },
          {
            code: "cause_process.change_not_managed.temp_fix_permanent",
            labels: {
              en: "Temporary change became permanent",
              hi: "थोड़े दिन का जुगाड़ हमेशा चला",
            },
            iconKey: "infinity",
            fishboneCategory: "PROCESS",
            sortWeight: 2,
          },
        ],
      },
    ],
  },
  {
    code: "cause_environment",
    labels: { en: "Environment / workplace", hi: "आस-पास का माहौल" },
    iconKey: "wind",
    fishboneCategory: "ENVIRONMENT",
    sortWeight: 3,
    children: [
      {
        code: "cause_environment.poor_lighting",
        labels: { en: "Poor lighting", hi: "रोशनी कम है" },
        iconKey: "lightbulb",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 0,
        children: [
          {
            code: "cause_environment.poor_lighting.tube_not_replaced",
            labels: {
              en: "Fused lights not replaced",
              hi: "फ्यूज़ ट्यूबलाइट बदली नहीं",
            },
            iconKey: "lightbulb",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 0,
          },
          {
            code: "cause_environment.poor_lighting.shadow_on_needle",
            labels: {
              en: "Shadow falls on needle point",
              hi: "सुई की जगह पर छाया पड़ती",
            },
            iconKey: "eye",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 1,
          },
          {
            code: "cause_environment.poor_lighting.no_task_light",
            labels: {
              en: "No task light on machine",
              hi: "मशीन पर अलग लाइट नहीं",
            },
            iconKey: "lamp",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_environment.heat_humidity",
        labels: { en: "Heat / humidity", hi: "गर्मी और उमस" },
        iconKey: "thermometer",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 1,
        children: [
          {
            code: "cause_environment.heat_humidity.pressing_area_hot",
            labels: {
              en: "Pressing area too hot",
              hi: "प्रेस सेक्शन बहुत गर्म रहता",
            },
            iconKey: "flame",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 0,
          },
          {
            code: "cause_environment.heat_humidity.fans_insufficient",
            labels: {
              en: "Fans / ventilation not enough",
              hi: "पंखे और हवा का इंतज़ाम कम",
            },
            iconKey: "fan",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 1,
          },
          {
            code: "cause_environment.heat_humidity.water_far",
            labels: {
              en: "Drinking water far from line",
              hi: "पीने का पानी दूर है",
            },
            iconKey: "droplets",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_environment.dust_fumes",
        labels: { en: "Dust / lint / fumes", hi: "धूल, रुई के रेशे, धुआं" },
        iconKey: "haze",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 2,
        children: [
          {
            code: "cause_environment.dust_fumes.cutting_dust",
            labels: {
              en: "Cutting room fabric dust",
              hi: "कटिंग रूम में कपड़े की धूल",
            },
            iconKey: "scissors",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 0,
          },
          {
            code: "cause_environment.dust_fumes.exhaust_not_working",
            labels: { en: "Exhaust fan not working", hi: "एग्ज़ॉस्ट पंखा खराब है" },
            iconKey: "fan",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 1,
          },
          {
            code: "cause_environment.dust_fumes.spot_gun_fumes",
            labels: {
              en: "Spot-cleaning gun fumes",
              hi: "स्पॉट गन का केमिकल धुआं",
            },
            iconKey: "spray-can",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_environment.noise_vibration",
        labels: { en: "Noise / vibration", hi: "शोर और कंपन" },
        iconKey: "volume-2",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 3,
        children: [
          {
            code: "cause_environment.noise_vibration.generator_open",
            labels: {
              en: "Generator without enclosure",
              hi: "जनरेटर के चारों ओर कवर नहीं",
            },
            iconKey: "zap",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 0,
          },
          {
            code: "cause_environment.noise_vibration.compressor_indoor",
            labels: {
              en: "Compressor inside work hall",
              hi: "कंप्रेसर हॉल के अंदर लगा है",
            },
            iconKey: "gauge",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 1,
          },
          {
            code: "cause_environment.noise_vibration.unserviced_machines",
            labels: {
              en: "Noisy unserviced machines",
              hi: "बिना सर्विस की मशीनों का शोर",
            },
            iconKey: "cog",
            fishboneCategory: "ENVIRONMENT",
            sortWeight: 2,
          },
        ],
      },
    ],
  },
  {
    code: "cause_material",
    labels: { en: "Material", hi: "माल / सामग्री" },
    iconKey: "box",
    fishboneCategory: "MATERIAL",
    sortWeight: 4,
    children: [
      {
        code: "cause_material.poor_quality_input",
        labels: { en: "Poor quality input", hi: "कच्चा माल खराब है" },
        iconKey: "thumbs-down",
        fishboneCategory: "MATERIAL",
        sortWeight: 0,
        children: [
          {
            code: "cause_material.poor_quality_input.fabric_defects",
            labels: {
              en: "Fabric slippery or defective",
              hi: "कपड़ा फिसलन भरा या खराब",
            },
            iconKey: "layers",
            fishboneCategory: "MATERIAL",
            sortWeight: 0,
          },
          {
            code: "cause_material.poor_quality_input.thread_breaking",
            labels: {
              en: "Thread breaking repeatedly",
              hi: "धागा बार-बार टूटता है",
            },
            iconKey: "scissors",
            fishboneCategory: "MATERIAL",
            sortWeight: 1,
          },
          {
            code: "cause_material.poor_quality_input.substandard_chemicals",
            labels: {
              en: "Substandard chemicals supplied",
              hi: "घटिया केमिकल आया है",
            },
            iconKey: "flask-conical",
            fishboneCategory: "MATERIAL",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_material.wrong_storage",
        labels: { en: "Wrong storage", hi: "सामान गलत तरह रखा" },
        iconKey: "archive",
        fishboneCategory: "MATERIAL",
        sortWeight: 1,
        children: [
          {
            code: "cause_material.wrong_storage.flammable_near_heat",
            labels: {
              en: "Flammables near heat source",
              hi: "जलने वाला माल गर्मी के पास",
            },
            iconKey: "flame",
            fishboneCategory: "MATERIAL",
            sortWeight: 0,
          },
          {
            code: "cause_material.wrong_storage.heavy_on_top",
            labels: {
              en: "Heavy items on top shelf",
              hi: "भारी सामान ऊपर रखा है",
            },
            iconKey: "weight",
            fishboneCategory: "MATERIAL",
            sortWeight: 1,
          },
          {
            code: "cause_material.wrong_storage.no_designated_place",
            labels: {
              en: "No fixed place for material",
              hi: "सामान की तय जगह नहीं है",
            },
            iconKey: "map-pin",
            fishboneCategory: "MATERIAL",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_material.sharp_heavy_items",
        labels: { en: "Sharp / heavy items", hi: "नुकीला या भारी सामान" },
        iconKey: "alert-triangle",
        fishboneCategory: "MATERIAL",
        sortWeight: 2,
        children: [
          {
            code: "cause_material.sharp_heavy_items.rolls_too_heavy",
            labels: {
              en: "Fabric rolls too heavy",
              hi: "कपड़े के रोल बहुत भारी",
            },
            iconKey: "weight",
            fishboneCategory: "MATERIAL",
            sortWeight: 0,
          },
          {
            code: "cause_material.sharp_heavy_items.needles_blades_loose",
            labels: {
              en: "Loose needles / blades lying around",
              hi: "सुई-ब्लेड खुले पड़े हैं",
            },
            iconKey: "scissors",
            fishboneCategory: "MATERIAL",
            sortWeight: 1,
          },
          {
            code: "cause_material.sharp_heavy_items.broken_pallets",
            labels: {
              en: "Broken pallets with nails",
              hi: "टूटे पैलेट में कीलें निकलीं",
            },
            iconKey: "hammer",
            fishboneCategory: "MATERIAL",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_material.packaging_waste",
        labels: { en: "Packaging & waste buildup", hi: "पैकिंग का कचरा जमा" },
        iconKey: "trash-2",
        fishboneCategory: "MATERIAL",
        sortWeight: 3,
        children: [
          {
            code: "cause_material.packaging_waste.poly_bags_floor",
            labels: { en: "Poly bags on floor", hi: "फर्श पर पॉलीथिन फैली है" },
            iconKey: "layers",
            fishboneCategory: "MATERIAL",
            sortWeight: 0,
          },
          {
            code: "cause_material.packaging_waste.carton_strapping",
            labels: {
              en: "Carton straps / clips lying around",
              hi: "पट्टी और क्लिप बिखरी हैं",
            },
            iconKey: "package",
            fishboneCategory: "MATERIAL",
            sortWeight: 1,
          },
          {
            code: "cause_material.packaging_waste.lint_bags_stored",
            labels: {
              en: "Lint / cutting waste bags stored too long",
              hi: "कतरन की बोरियां जमा रहती हैं",
            },
            iconKey: "archive",
            fishboneCategory: "MATERIAL",
            sortWeight: 2,
          },
        ],
      },
    ],
  },
  {
    code: "cause_management",
    labels: { en: "Management / system", hi: "मैनेजमेंट / सिस्टम" },
    iconKey: "briefcase",
    fishboneCategory: "MANAGEMENT",
    sortWeight: 5,
    children: [
      {
        code: "cause_management.weak_supervision",
        labels: { en: "Weak supervision", hi: "निगरानी कम है" },
        iconKey: "eye",
        fishboneCategory: "MANAGEMENT",
        sortWeight: 0,
        children: [
          {
            code: "cause_management.weak_supervision.supervisor_overloaded",
            labels: {
              en: "Supervisor has too many lines",
              hi: "एक सुपरवाइज़र पर बहुत लाइनें",
            },
            iconKey: "users",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 0,
          },
          {
            code: "cause_management.weak_supervision.night_unsupervised",
            labels: {
              en: "No supervisor on night shift",
              hi: "रात में सुपरवाइज़र नहीं होता",
            },
            iconKey: "moon",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 1,
          },
          {
            code: "cause_management.weak_supervision.contractor_unchecked",
            labels: {
              en: "Contractor work not checked",
              hi: "ठेकेदार का काम बिना जांच",
            },
            iconKey: "user-x",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_management.production_pressure",
        labels: { en: "Production over safety", hi: "प्रोडक्शन का दबाव" },
        iconKey: "trending-up",
        fishboneCategory: "MANAGEMENT",
        sortWeight: 1,
        children: [
          {
            code: "cause_management.production_pressure.shipment_deadline",
            labels: {
              en: "Shipment deadline pressure",
              hi: "शिपमेंट की डेडलाइन का दबाव",
            },
            iconKey: "truck",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 0,
          },
          {
            code: "cause_management.production_pressure.incentive_speed_only",
            labels: {
              en: "Incentive only for speed",
              hi: "इनाम सिर्फ तेज़ी पर मिलता है",
            },
            iconKey: "gauge",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 1,
          },
          {
            code: "cause_management.production_pressure.stops_discouraged",
            labels: {
              en: "Stopping work is discouraged",
              hi: "काम रोकने पर डांट पड़ती है",
            },
            iconKey: "megaphone",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_management.no_training_system",
        labels: { en: "No training system", hi: "ट्रेनिंग का सिस्टम नहीं" },
        iconKey: "graduation-cap",
        fishboneCategory: "MANAGEMENT",
        sortWeight: 2,
        children: [
          {
            code: "cause_management.no_training_system.no_induction",
            labels: {
              en: "No induction for new joiners",
              hi: "नए वर्कर की ट्रेनिंग नहीं होती",
            },
            iconKey: "user-x",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 0,
          },
          {
            code: "cause_management.no_training_system.no_records",
            labels: {
              en: "No record of who is trained",
              hi: "किसे ट्रेनिंग मिली, रिकॉर्ड नहीं",
            },
            iconKey: "file-text",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 1,
          },
          {
            code: "cause_management.no_training_system.no_trainer",
            labels: {
              en: "No one responsible for training",
              hi: "ट्रेनिंग की ज़िम्मेदारी किसी की नहीं",
            },
            iconKey: "user-x",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_management.issues_not_fixed",
        labels: {
          en: "Reported issues not fixed",
          hi: "शिकायत पर काम नहीं होता",
        },
        iconKey: "bell-off",
        fishboneCategory: "MANAGEMENT",
        sortWeight: 3,
        children: [
          {
            code: "cause_management.issues_not_fixed.no_tracking",
            labels: {
              en: "No tracking of complaints",
              hi: "शिकायतों का फॉलो-अप नहीं",
            },
            iconKey: "list-checks",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 0,
          },
          {
            code: "cause_management.issues_not_fixed.no_budget",
            labels: {
              en: "No budget given for repairs",
              hi: "मरम्मत के लिए पैसा नहीं मिला",
            },
            iconKey: "wallet",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 1,
          },
          {
            code: "cause_management.issues_not_fixed.repeated_ignored",
            labels: {
              en: "Same hazard ignored repeatedly",
              hi: "एक ही खतरा बार-बार अनदेखा",
            },
            iconKey: "repeat",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 2,
          },
        ],
      },
      {
        code: "cause_management.rules_not_enforced",
        labels: {
          en: "Rules unclear or not enforced",
          hi: "नियम साफ नहीं या लागू नहीं",
        },
        iconKey: "scale",
        fishboneCategory: "MANAGEMENT",
        sortWeight: 4,
        children: [
          {
            code: "cause_management.rules_not_enforced.not_communicated",
            labels: {
              en: "Rules never communicated",
              hi: "नियम बताए ही नहीं गए",
            },
            iconKey: "megaphone",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 0,
          },
          {
            code: "cause_management.rules_not_enforced.no_consequence",
            labels: {
              en: "No action on violations",
              hi: "नियम तोड़ने पर कुछ नहीं होता",
            },
            iconKey: "shield-off",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 1,
          },
          {
            code: "cause_management.rules_not_enforced.paper_audits",
            labels: {
              en: "Audits done only on paper",
              hi: "ऑडिट सिर्फ कागज़ों पर होता",
            },
            iconKey: "file-text",
            fishboneCategory: "MANAGEMENT",
            sortWeight: 2,
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 3. CONTROL LIBRARY — 6 standard control families, garment-factory specifics
// ---------------------------------------------------------------------------

export const CONTROL_LIBRARY: TaxonomyNodeSeed[] = [
  {
    code: "control_training",
    labels: { en: "Training", hi: "ट्रेनिंग" },
    iconKey: "graduation-cap",
    fishboneCategory: "PERSON",
    sortWeight: 0,
    children: [
      {
        code: "control_training.toolbox_talk",
        labels: {
          en: "Toolbox talk on this hazard",
          hi: "इस खतरे पर टूलबॉक्स बात",
        },
        iconKey: "megaphone",
        fishboneCategory: "PERSON",
        sortWeight: 0,
      },
      {
        code: "control_training.machine_training",
        labels: {
          en: "Hands-on machine training",
          hi: "मशीन पर हाथों-हाथ ट्रेनिंग",
        },
        iconKey: "cog",
        fishboneCategory: "PERSON",
        sortWeight: 1,
      },
      {
        code: "control_training.ppe_training",
        labels: {
          en: "PPE use demonstration",
          hi: "PPE पहनने की ट्रेनिंग",
        },
        iconKey: "hard-hat",
        fishboneCategory: "PERSON",
        sortWeight: 2,
      },
      {
        code: "control_training.refresher_records",
        labels: {
          en: "Refresher training with records",
          hi: "दोबारा ट्रेनिंग और रिकॉर्ड",
        },
        iconKey: "repeat",
        fishboneCategory: "MANAGEMENT",
        sortWeight: 3,
      },
    ],
  },
  {
    code: "control_guard",
    labels: { en: "Guard / physical barrier", hi: "गार्ड / रोक-बाड़" },
    iconKey: "shield",
    fishboneCategory: "EQUIPMENT",
    sortWeight: 1,
    children: [
      {
        code: "control_guard.needle_eye_guard",
        labels: {
          en: "Fit needle and eye guards",
          hi: "नीडल और आँख का गार्ड लगवाना",
        },
        iconKey: "shield-check",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 0,
      },
      {
        code: "control_guard.belt_pulley_cover",
        labels: {
          en: "Cover belts and pulleys",
          hi: "बेल्ट-पुली पर कवर लगाना",
        },
        iconKey: "cog",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 1,
      },
      {
        code: "control_guard.machine_fencing",
        labels: {
          en: "Fencing around danger zone",
          hi: "खतरे वाली जगह घेराबंदी",
        },
        iconKey: "fence",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 2,
      },
      {
        code: "control_guard.edge_protection",
        labels: {
          en: "Railing / edge protection at height",
          hi: "ऊँचाई पर रेलिंग लगाना",
        },
        iconKey: "construction",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 3,
      },
      {
        code: "control_guard.interlock_repair",
        labels: {
          en: "Repair guard interlocks",
          hi: "गार्ड का इंटरलॉक ठीक कराना",
        },
        iconKey: "lock",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 4,
      },
    ],
  },
  {
    code: "control_signage",
    labels: { en: "Signage / marking", hi: "साइन बोर्ड / निशान" },
    iconKey: "signpost",
    fishboneCategory: "ENVIRONMENT",
    sortWeight: 2,
    children: [
      {
        code: "control_signage.hazard_sign",
        labels: {
          en: "Hazard warning sign (bilingual)",
          hi: "खतरे का बोर्ड (हिंदी में भी)",
        },
        iconKey: "alert-triangle",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 0,
      },
      {
        code: "control_signage.floor_marking",
        labels: {
          en: "Floor marking for walkways",
          hi: "रास्तों पर पीली पट्टी बनाना",
        },
        iconKey: "paintbrush",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 1,
      },
      {
        code: "control_signage.exit_signage",
        labels: {
          en: "Exit and assembly point signage",
          hi: "बाहर जाने के रास्ते के साइन",
        },
        iconKey: "door-open",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 2,
      },
      {
        code: "control_signage.ppe_zone_boards",
        labels: {
          en: "PPE-mandatory zone boards",
          hi: "PPE ज़रूरी वाले बोर्ड लगाना",
        },
        iconKey: "hard-hat",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 3,
      },
    ],
  },
  {
    code: "control_procedure",
    labels: { en: "Procedure change", hi: "काम का तरीका बदलना" },
    iconKey: "clipboard-list",
    fishboneCategory: "PROCESS",
    sortWeight: 3,
    children: [
      {
        code: "control_procedure.sop_update",
        labels: {
          en: "Write / update SOP (Hindi too)",
          hi: "SOP बनाना या सुधारना (हिंदी में)",
        },
        iconKey: "file-text",
        fishboneCategory: "PROCESS",
        sortWeight: 0,
      },
      {
        code: "control_procedure.loto_before_repair",
        labels: {
          en: "Lockout-tagout before repair",
          hi: "मरम्मत से पहले मशीन लॉक (LOTO)",
        },
        iconKey: "lock",
        fishboneCategory: "PROCESS",
        sortWeight: 1,
      },
      {
        code: "control_procedure.permit_to_work",
        labels: {
          en: "Permit-to-work for risky jobs",
          hi: "खतरनाक काम पर परमिट ज़रूरी",
        },
        iconKey: "file-check",
        fishboneCategory: "PROCESS",
        sortWeight: 2,
      },
      {
        code: "control_procedure.shift_start_checklist",
        labels: {
          en: "Start-of-shift safety checklist",
          hi: "शिफ्ट शुरू में चेकलिस्ट भरना",
        },
        iconKey: "list-checks",
        fishboneCategory: "PROCESS",
        sortWeight: 3,
      },
      {
        code: "control_procedure.job_rotation",
        labels: {
          en: "Job rotation for repetitive work",
          hi: "काम बदल-बदल कर देना",
        },
        iconKey: "refresh-cw",
        fishboneCategory: "PROCESS",
        sortWeight: 4,
      },
    ],
  },
  {
    code: "control_better_tool",
    labels: { en: "Better tool / equipment", hi: "बेहतर औज़ार / मशीन" },
    iconKey: "wrench",
    fishboneCategory: "EQUIPMENT",
    sortWeight: 4,
    children: [
      {
        code: "control_better_tool.replace_worn",
        labels: {
          en: "Replace worn parts / machines",
          hi: "घिसे पुर्ज़े या मशीन बदलना",
        },
        iconKey: "replace",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 0,
      },
      {
        code: "control_better_tool.lifting_aids",
        labels: {
          en: "Provide trolleys / lifting aids",
          hi: "ट्रॉली या उठाने का साधन देना",
        },
        iconKey: "shopping-cart",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 1,
      },
      {
        code: "control_better_tool.ergonomic_seating",
        labels: {
          en: "Adjustable chairs / anti-fatigue mats",
          hi: "सही कुर्सी और मैट देना",
        },
        iconKey: "armchair",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 2,
      },
      {
        code: "control_better_tool.lint_extraction",
        labels: {
          en: "Lint extraction / exhaust system",
          hi: "धूल खींचने वाला सिस्टम लगाना",
        },
        iconKey: "fan",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 3,
      },
      {
        code: "control_better_tool.task_lighting",
        labels: {
          en: "Task lighting on machines",
          hi: "मशीन पर अलग लाइट लगाना",
        },
        iconKey: "lightbulb",
        fishboneCategory: "EQUIPMENT",
        sortWeight: 4,
      },
    ],
  },
  {
    code: "control_housekeeping",
    labels: { en: "Housekeeping", hi: "साफ़-सफ़ाई" },
    iconKey: "brush",
    fishboneCategory: "ENVIRONMENT",
    sortWeight: 5,
    children: [
      {
        code: "control_housekeeping.cleaning_schedule",
        labels: {
          en: "Fixed cleaning schedule",
          hi: "सफाई का पक्का टाइम-टेबल",
        },
        iconKey: "calendar",
        fishboneCategory: "MANAGEMENT",
        sortWeight: 0,
      },
      {
        code: "control_housekeeping.waste_bins",
        labels: {
          en: "Enough bins, timely disposal",
          hi: "काफी डस्टबिन, रोज़ कचरा हटाना",
        },
        iconKey: "trash-2",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 1,
      },
      {
        code: "control_housekeeping.spill_kit",
        labels: {
          en: "Spill kit and immediate cleanup",
          hi: "गिरते ही साफ करने का सामान",
        },
        iconKey: "droplets",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 2,
      },
      {
        code: "control_housekeeping.fixed_storage_5s",
        labels: {
          en: "Fixed place for everything (5S)",
          hi: "हर चीज़ की तय जगह (5S)",
        },
        iconKey: "archive",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 3,
      },
      {
        code: "control_housekeeping.lint_removal",
        labels: {
          en: "Daily lint removal near motors",
          hi: "मोटर के पास रोज़ रुई हटाना",
        },
        iconKey: "wind",
        fishboneCategory: "ENVIRONMENT",
        sortWeight: 4,
      },
    ],
  },
];

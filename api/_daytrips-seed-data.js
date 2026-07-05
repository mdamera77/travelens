// Curated day-trip content, keyed by base city (lowercase).
// Add new cities here as you expand. Each entry becomes one card in the wizard.
//
// duration: "half" | "full" — drives whether the afternoon reopens as open-city
// getThere: short, no live lookups — you already know this from your own trips
// passInfo: optional — combined tickets, city passes that apply

export const daytripsSeedData = {
  prague: [
    {
      id: "kutna-hora",
      name: "Kutná Hora",
      duration: "half",
      getThere: "Train from Praha hlavní nádraží, ~50 min each way",
      bestFor: "Bone church (ossuary), silver mines, small-town charm",
      passInfo: "Combined ticket covers ossuary + St. Barbara's Cathedral"
    },
    {
      id: "cesky-krumlov",
      name: "Český Krumlov + Hluboká",
      duration: "full",
      getThere: "Bus or car, ~2.5 hrs each way; often combined as one long day",
      bestFor: "Fairytale castle town, Hluboká Castle on the way back",
      passInfo: "No combined ticket — castle entries are separate"
    },
    {
      id: "bohemian-switzerland",
      name: "Bohemian Switzerland (Saxon Switzerland)",
      duration: "full",
      getThere: "Best done as a guided/organized tour — remote, best with transport included",
      bestFor: "Dramatic sandstone cliffs, Pravčická brána, river views",
      passInfo: "Usually booked as a full tour package (e.g. Viator, GetYourGuide)"
    }
  ]
};

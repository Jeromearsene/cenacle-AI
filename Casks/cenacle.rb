cask "cenacle" do
  arch arm: "arm64", intel: "x64"

  version "0.8.0"
  sha256 arm:   "dbe4b2af2924188d2138065fa3b949321fba71e60bb20e79b2874869384a4d07",
         intel: "ec0c77920d5f9e6b23d58c3aa598a428c7f2aab5af2f109c8d1156e68ea24d32"

  url "https://github.com/Jeromearsene/cenacle-AI/releases/download/v#{version}/Cenacle-#{version}-mac-#{arch}.dmg",
      verified: "github.com/Jeromearsene/cenacle-AI/"
  name "Cénacle"
  desc "Use several Claude, ChatGPT, Gemini and Perplexity accounts in one window"
  homepage "https://jeromearsene.github.io/cenacle-AI/"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: ">= :ventura"

  app "Cenacle.app"

  # The app is signed ad hoc (no Apple Developer ID, no notarization). Gatekeeper would block the
  # first launch of a quarantined copy, so the quarantine flag is removed after the install.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/Cenacle.app"]
  end

  zap trash: [
    "~/Library/Application Support/Cénacle",
    "~/Library/Caches/io.github.jeromearsene.cenacle",
    "~/Library/Caches/io.github.jeromearsene.cenacle.ShipIt",
    "~/Library/Preferences/io.github.jeromearsene.cenacle.plist",
    "~/Library/Saved Application State/io.github.jeromearsene.cenacle.savedState",
  ]

  caveats <<~EOS
    Cénacle is not signed with an Apple Developer ID, so macOS cannot update it by itself.
    Update it with Homebrew:
      brew upgrade --cask cenacle
  EOS
end

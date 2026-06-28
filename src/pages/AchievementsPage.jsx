import { useEffect, useState } from "react"
import { supabase } from "./supabaseClient"
import { checkAndAwardAchievements } from "./AchievementsPage"

const ACHIEVEMENT_META = {
  first_connection: {
    icon: "🤝",
    title: "First Connection",
    description: "Connected with your first crew member.",
    rarity: "Common",
    rarityColor: "#7CFC9B",
  },
  five_connections: {
    icon: "🌐",
    title: "Network Builder",
    description: "Expanded your crew to 5 connections.",
    rarity: "Uncommon",
    rarityColor: "#60BFFF",
  },
  first_group: {
    icon: "🎮",
    title: "Squad Up",
    description: "Joined your first gaming group.",
    rarity: "Common",
    rarityColor: "#7CFC9B",
  },
  group_leader: {
    icon: "👑",
    title: "Group Leader",
    description: "Led a group as the captain.",
    rarity: "Rare",
    rarityColor: "#C77DFF",
  },
  profile_complete: {
    icon: "⚡",
    title: "Ready to Play",
    description: "Completed your full profile.",
    rarity: "Common",
    rarityColor: "#7CFC9B",
  },
}

const ALL_TYPES = Object.keys(ACHIEVEMENT_META)

export default function AchievementsPage() {
  const [earned, setEarned] = useState(new Set())
  const [earnedDates, setEarnedDates] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await checkAndAwardAchievements(user.id)

      const { data } = await supabase
        .from("achievements")
        .select("type, created_at")
        .eq("user_id", user.id)

      if (data) {
        const earnedSet = new Set(data.map((a) => a.type))
        const datesMap = {}
        data.forEach((a) => { datesMap[a.type] = a.created_at })
        setEarned(earnedSet)
        setEarnedDates(datesMap)
      }

      setLoading(false)
    }

    init()
  }, [])

  const earnedCount = earned.size
  const totalCount = ALL_TYPES.length
  const progressPct = Math.round((earnedCount / totalCount) * 100)

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>
          <span style={styles.titleAccent}>Achievements</span>
        </h1>
        <p style={styles.subtitle}>Milestones earned on your FindMyCrew journey.</p>
      </div>

      {!loading && (
        <div style={styles.progressWrapper}>
          <div style={styles.progressMeta}>
            <span style={styles.progressLabel}>Progress</span>
            <span style={styles.progressCount}>
              {earnedCount} / {totalCount} unlocked
            </span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.loading}>Loading achievements…</div>
      ) : (
        <div style={styles.grid}>
          {ALL_TYPES.map((type) => {
            const meta = ACHIEVEMENT_META[type]
            const isEarned = earned.has(type)
            const date = earnedDates[type]
              ? new Date(earnedDates[type]).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null

            return (
              <div
                key={type}
                style={{
                  ...styles.card,
                  ...(isEarned ? styles.cardEarned : styles.cardLocked),
                }}
              >
                <span
                  style={{
                    ...styles.rarityBadge,
                    color: isEarned ? meta.rarityColor : "#555",
                    borderColor: isEarned ? meta.rarityColor + "44" : "#333",
                    backgroundColor: isEarned ? meta.rarityColor + "11" : "transparent",
                  }}
                >
                  {meta.rarity}
                </span>

                <div style={{ ...styles.iconWrap, filter: isEarned ? "none" : "grayscale(1) opacity(0.25)" }}>
                  <span style={styles.icon}>{meta.icon}</span>
                </div>

                <h3 style={{ ...styles.cardTitle, color: isEarned ? "#F0EEF5" : "#555" }}>
                  {meta.title}
                </h3>
                <p style={{ ...styles.cardDesc, color: isEarned ? "#9B97A8" : "#444" }}>
                  {meta.description}
                </p>

                <div style={styles.cardFooter}>
                  {isEarned ? (
                    <span style={{ ...styles.footerLabel, color: "#6A6578" }}>
                      Earned {date}
                    </span>
                  ) : (
                    <span style={{ ...styles.footerLabel, color: "#3D3A47" }}>
                      🔒 Locked
                    </span>
                  )}
                </div>

                {isEarned && (
                  <div style={{ ...styles.glowLine, background: meta.rarityColor }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#0F0D14",
    color: "#F0EEF5",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: "48px 24px 80px",
    maxWidth: 900,
    margin: "0 auto",
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 800,
    margin: 0,
    letterSpacing: "-0.5px",
  },
  titleAccent: {
    background: "linear-gradient(90deg, #C77DFF, #60BFFF)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#6A6578",
  },
  progressWrapper: {
    marginBottom: 40,
  },
  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#6A6578",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  progressCount: {
    fontSize: 13,
    color: "#9B97A8",
  },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: "#1E1A28",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 99,
    background: "linear-gradient(90deg, #C77DFF, #60BFFF)",
    transition: "width 0.6s ease",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 20,
  },
  card: {
    position: "relative",
    borderRadius: 16,
    padding: "24px 20px 20px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  cardEarned: {
    backgroundColor: "#17131F",
    border: "1px solid #2E2840",
  },
  cardLocked: {
    backgroundColor: "#110F18",
    border: "1px solid #1C1A24",
  },
  rarityBadge: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    border: "1px solid",
    borderRadius: 6,
    padding: "2px 8px",
    marginBottom: 4,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#1E1A28",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  icon: {
    fontSize: 26,
    lineHeight: 1,
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
  },
  cardDesc: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
  },
  cardFooter: {
    marginTop: 8,
  },
  footerLabel: {
    fontSize: 12,
    fontWeight: 500,
  },
  glowLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.6,
  },
  loading: {
    color: "#6A6578",
    fontSize: 15,
    textAlign: "center",
    paddingTop: 60,
  },
}
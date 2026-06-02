import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  PanInfo,
  useMotionValue,
  useTransform,
} from "motion/react";
import promptsCsv from "./data/prompts.csv?raw";

type PromptCardData = {
  id: string;
  context: string;
  question: string;
  scale: {
    one: string;
    ten: string;
  };
};

type DealtCard = {
  instanceId: string;
  design: number;
  prompt: PromptCardData;
};

type ExitTarget = {
  x: number;
  y: number;
  rotate: number;
};

const CARD_DESIGNS = 5;
const DISCARD_VELOCITY_THRESHOLD = 920;
const MOBILE_DISCARD_VELOCITY_THRESHOLD = 1450;
const FALLBACK_EXIT: ExitTarget = { x: -900, y: -90, rotate: -18 };

function parseCsv(source: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...records] = rows.filter((record) =>
    record.some((value) => value.trim().length > 0),
  );

  return records.map((record) =>
    Object.fromEntries(
      headers.map((header, index) => [header.trim(), record[index]?.trim() ?? ""]),
    ),
  );
}

function loadPrompts(): PromptCardData[] {
  return parseCsv(promptsCsv).map((record) => ({
    id: record.id,
    context: record.context,
    question: record.question,
    scale: {
      one: record.scale1,
      ten: record.scale10,
    },
  }));
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function dealDeck(prompts: PromptCardData[]): DealtCard[] {
  return shuffle(prompts).map((prompt, index) => ({
    instanceId: `${prompt.id}-${Date.now()}-${index}`,
    design: Math.floor(Math.random() * CARD_DESIGNS),
    prompt,
  }));
}

function getExitTarget(x: number, y: number): ExitTarget {
  const magnitude = Math.hypot(x, y);

  if (magnitude < 1) {
    return FALLBACK_EXIT;
  }

  const viewport = Math.max(window.innerWidth, window.innerHeight);
  const distance = viewport + 520;
  const normalizedX = x / magnitude;
  const normalizedY = y / magnitude;

  return {
    x: normalizedX * distance,
    y: normalizedY * distance,
    rotate: Math.max(-28, Math.min(28, normalizedX * 24 + normalizedY * 8)),
  };
}

function getVelocityExitTarget(info: PanInfo): ExitTarget {
  const velocityMagnitude = Math.hypot(info.velocity.x, info.velocity.y);

  if (velocityMagnitude > 1) {
    return getExitTarget(info.velocity.x, info.velocity.y);
  }

  return getExitTarget(info.offset.x, info.offset.y);
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);

    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

function App() {
  const prompts = useMemo(loadPrompts, []);
  const [deck, setDeck] = useState<DealtCard[]>(() => dealDeck(prompts));
  const discardZoneRef = useRef<HTMLElement | null>(null);
  const isMobileLayout = useMediaQuery("(max-width: 760px)");
  const [isDragging, setIsDragging] = useState(false);
  const [isInDiscardZone, setIsInDiscardZone] = useState(false);
  const [exitTarget, setExitTarget] = useState<ExitTarget | null>(null);
  const [hasDismissedMobileIntro, setHasDismissedMobileIntro] = useState(false);

  const currentCard = deck[0];
  const promptsRemaining = deck.length;
  const isDiscarding = exitTarget !== null;

  const isPointInDiscardZone = useCallback((point: PanInfo["point"]) => {
    if (isMobileLayout) {
      return false;
    }

    const zone = discardZoneRef.current;

    if (!zone) {
      return false;
    }

    const rect = zone.getBoundingClientRect();

    return (
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom
    );
  }, [isMobileLayout]);

  const discardCurrent = useCallback(
    (target: ExitTarget = FALLBACK_EXIT) => {
      if (isDiscarding || !currentCard) {
        return;
      }

      setIsDragging(false);
      setExitTarget(target);
    },
    [currentCard, isDiscarding],
  );

  const completeDiscard = useCallback(() => {
    setDeck((currentDeck) => {
      if (currentDeck.length <= 1) {
        return dealDeck(prompts);
      }

      return currentDeck.slice(1);
    });
    setIsInDiscardZone(false);
    setExitTarget(null);
  }, [prompts]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      discardCurrent(FALLBACK_EXIT);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [discardCurrent]);

  return (
    <main className="app-shell">
      <DiscardZone
        ref={discardZoneRef}
        isVisible={isDragging && !isMobileLayout}
        isActive={isInDiscardZone && !isMobileLayout}
      />

      {isMobileLayout && !hasDismissedMobileIntro ? (
        <MobileIntroOverlay onDismiss={() => setHasDismissedMobileIntro(true)} />
      ) : null}

      <section className="deck-stage" aria-label="Top Ten Promptkarten">
        <div className="counter">{promptsRemaining} Karten übrig</div>

        <DeckStack count={Math.min(promptsRemaining - 1, 3)} />

        <AnimatePresence mode="wait">
          {currentCard ? (
            <PromptCard
              key={currentCard.instanceId}
              card={currentCard}
              exitTarget={exitTarget}
              isOverDiscardZone={isInDiscardZone}
              onDiscardComplete={completeDiscard}
              onDragStart={() => {
                setIsDragging(true);
                setIsInDiscardZone(false);
              }}
              onDrag={(info) => setIsInDiscardZone(isPointInDiscardZone(info.point))}
              onDragEnd={(info) => {
                setIsDragging(false);
                setIsInDiscardZone(false);

                const hasReachedDiscardZone = isPointInDiscardZone(info.point);
                const velocityThreshold = isMobileLayout
                  ? MOBILE_DISCARD_VELOCITY_THRESHOLD
                  : DISCARD_VELOCITY_THRESHOLD;
                const isFastEnough =
                  Math.hypot(info.velocity.x, info.velocity.y) >= velocityThreshold;

                if (hasReachedDiscardZone || isFastEnough) {
                  discardCurrent(
                    hasReachedDiscardZone ? FALLBACK_EXIT : getVelocityExitTarget(info),
                  );
                }
              }}
            />
          ) : null}
        </AnimatePresence>

        {!isMobileLayout ? (
          <button
            className="next-button"
            type="button"
            aria-label="Nächste Karte"
            disabled={isDiscarding}
            onClick={() => discardCurrent(FALLBACK_EXIT)}
          >
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </section>
    </main>
  );
}

function MobileIntroOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      className="mobile-intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mobile-intro-content">
        <p>Swipe to discard</p>
        <button type="button" onClick={onDismiss}>
          Okay!
        </button>
      </div>
    </motion.div>
  );
}

type PromptCardProps = {
  card: DealtCard;
  exitTarget: ExitTarget | null;
  isOverDiscardZone: boolean;
  onDiscardComplete: () => void;
  onDragStart: () => void;
  onDrag: (info: PanInfo) => void;
  onDragEnd: (info: PanInfo) => void;
};

function PromptCard({
  card,
  exitTarget,
  isOverDiscardZone,
  onDiscardComplete,
  onDragStart,
  onDrag,
  onDragEnd,
}: PromptCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-9, 9]);
  const isExiting = exitTarget !== null;

  return (
    <motion.article
      className={`prompt-card card-design-${card.design} ${
        isOverDiscardZone ? "is-over-discard" : ""
      }`}
      style={{ x, rotate }}
      drag={!isExiting}
      dragElastic={0.18}
      dragMomentum={false}
      dragSnapToOrigin={!isExiting}
      initial={{ y: 42, scale: 0.94, opacity: 0, rotate: -1.5 }}
      animate={
        isExiting
          ? {
              x: exitTarget.x,
              y: exitTarget.y,
              rotate: exitTarget.rotate,
              scale: 0.96,
              opacity: 0,
            }
          : { y: 0, scale: 1, opacity: 1 }
      }
      transition={
        isExiting
          ? { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
          : { type: "spring", stiffness: 360, damping: 30, mass: 0.86 }
      }
      onAnimationComplete={() => {
        if (isExiting) {
          onDiscardComplete();
        }
      }}
      onDragStart={onDragStart}
      onDrag={(_, info) => onDrag(info)}
      onDragEnd={(_, info) => onDragEnd(info)}
    >
      <div className="card-surface">
        <p className="card-context">{card.prompt.context}</p>
        <h1>{card.prompt.question}</h1>

        <div className="scale-row" aria-label="Skala von 1 bis 10">
          <ScaleBound label={card.prompt.scale.one} />
          <div className="scale-divider" aria-hidden="true" />
          <ScaleBound label={card.prompt.scale.ten} />
        </div>
        <ScaleBar />
      </div>
    </motion.article>
  );
}

function ScaleBound({ label }: { label: string }) {
  return (
    <div className="scale-bound">
      <span className="scale-label">{label}</span>
    </div>
  );
}

function ScaleBar() {
  return (
    <div className="scale-bar" aria-hidden="true">
      <span>1</span>
      <div className="scale-track" />
      <span>10</span>
    </div>
  );
}

function DeckStack({ count }: { count: number }) {
  return (
    <div className="deck-stack" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          className="stack-card"
          key={index}
          style={{
            transform: `translate(${(index + 1) * 7}px, ${(index + 1) * 9}px) rotate(${
              (index + 1) * 1.4
            }deg)`,
          }}
        />
      ))}
    </div>
  );
}

const DiscardZone = forwardRef<
  HTMLElement,
  {
    isVisible: boolean;
    isActive: boolean;
  }
>(function DiscardZone(
  {
    isVisible,
    isActive,
  },
  ref,
) {
  return (
    <motion.aside
      ref={ref}
      className={`discard-zone ${isActive ? "is-active" : ""}`}
      aria-hidden={!isVisible}
      initial={false}
      animate={{
        opacity: isVisible ? 1 : 0,
        x: isVisible ? 0 : -18,
      }}
      transition={{ duration: 0.16 }}
    >
      <span>discard</span>
    </motion.aside>
  );
});

export default App;

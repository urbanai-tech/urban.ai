"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  emitOrganicAnalyticsEvent,
  GEO_CTA_VIEW_EVENT,
  HUB_CTA_CLICK_EVENT,
} from "../lib/organicAnalytics";

const HUB_CTA_SELECTOR = '[data-urban-analytics="hub-cta"]';

type SeoOrganicCtaSectionProps = {
  children: ReactNode;
  className?: string;
  ctaContext: string;
  ctaCount: number;
  id?: string;
  pagePath: string;
  pageTitle: string;
  style?: CSSProperties;
};

export function SeoOrganicCtaSection({
  children,
  className,
  ctaContext,
  ctaCount,
  id,
  pagePath,
  pageTitle,
  style,
}: SeoOrganicCtaSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const hasTrackedViewRef = useRef(false);

  useEffect(() => {
    const section = sectionRef.current;
    hasTrackedViewRef.current = false;

    if (!section) return;

    const trackView = (visibilityTrigger: string) => {
      if (hasTrackedViewRef.current) return;
      hasTrackedViewRef.current = true;

      emitOrganicAnalyticsEvent(GEO_CTA_VIEW_EVENT, {
        cta_context: ctaContext,
        cta_count: ctaCount,
        page_path: pagePath,
        page_title: pageTitle,
        visibility_trigger: visibilityTrigger,
      });
    };

    if (typeof window.IntersectionObserver !== "function") {
      const frame = window.requestAnimationFrame(() => trackView("mount_fallback"));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.25,
          )
        ) {
          trackView("intersection_observer");
          observer.disconnect();
        }
      },
      { threshold: [0.25, 0.5] },
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, [ctaContext, ctaCount, pagePath, pageTitle]);

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    const anchor = target?.closest(HUB_CTA_SELECTOR) as HTMLAnchorElement | null;

    if (!anchor || !sectionRef.current?.contains(anchor)) return;

    const rawPosition = Number(anchor.dataset.analyticsPosition);
    const ctaPosition = Number.isFinite(rawPosition) ? rawPosition : undefined;

    emitOrganicAnalyticsEvent(HUB_CTA_CLICK_EVENT, {
      cta_context: ctaContext,
      cta_href: anchor.dataset.analyticsHref ?? anchor.getAttribute("href"),
      cta_label: anchor.dataset.analyticsLabel,
      cta_position: ctaPosition,
      page_path: pagePath,
      page_title: pageTitle,
    });
  };

  return (
    <section
      ref={sectionRef}
      id={id}
      className={className}
      style={style}
      onClick={handleClick}
    >
      {children}
    </section>
  );
}

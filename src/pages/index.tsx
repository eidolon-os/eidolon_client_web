import React from "react";
import Head from "next/head";
import { CompanionScene } from "@/avatar";
import { useConfig } from "@/hooks/useConfig";

/**
 * The web client is a companion's host-local body: opening it drops you
 * straight into the 2.5D companion conversation (no room/identity forms — the
 * client resolves its owner→master companion→web body via admin /api/bootstrap).
 */
export default function Home() {
  const { config } = useConfig();
  return (
    <>
      <Head>
        <title>{config.appTitle}</title>
        <meta name="description" content="Eidolon AI Companion" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <CompanionScene />
    </>
  );
}

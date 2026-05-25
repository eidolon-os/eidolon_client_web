import React from "react";
import Head from "next/head";
import { CompanionScene } from "@/avatar";
import { useConfig } from "@/hooks/useConfig";

export default function CompanionPage() {
  const { config } = useConfig();
  return (
    <>
      <Head>
        <title>{config.appTitle} · Companion</title>
        <meta name="description" content="Eidolon AI Companion" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <CompanionScene />
    </>
  );
}

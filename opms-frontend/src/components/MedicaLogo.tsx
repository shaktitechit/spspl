"use client";

import Image from "next/image";
import { useGetCompanyInfoQuery } from "@/store/api";
import { companyLetterheadLogoUrl, companyLetterheadName } from "@/lib/env";

type MedicaLogoProps = {
  className?: string;
  imgClassName?: string;
  priority?: boolean;
};

export function MedicaLogo({
  className = "",
  imgClassName = "",
  priority = false,
}: MedicaLogoProps) {
  const { data: companyInfo } = useGetCompanyInfoQuery();
  const logoUrl =
    companyInfo?.logo_url?.trim() || companyLetterheadLogoUrl() || "";
  const brandName =
    companyInfo?.trade_name?.trim() ||
    companyInfo?.legal_name?.trim() ||
    companyLetterheadName() ||
    "Company";

  if (logoUrl) {
    const isRemote = /^https?:\/\//i.test(logoUrl);
    return (
      <span className={`inline-flex items-center bg-transparent ${className}`.trim()}>
        {isRemote ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={brandName}
            className={`h-auto w-auto max-h-10 max-w-[11rem] bg-transparent object-contain object-left [background:none] ${imgClassName}`.trim()}
          />
        ) : (
          <Image
            src={logoUrl}
            alt={brandName}
            width={220}
            height={64}
            priority={priority}
            unoptimized
            className={`h-auto w-auto max-h-10 max-w-[11rem] bg-transparent object-contain object-left [background:none] ${imgClassName}`.trim()}
            sizes="(max-width: 1024px) 200px, 180px"
          />
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center text-sm font-bold tracking-tight text-foreground ${className}`.trim()}
    >
      {brandName}
    </span>
  );
}

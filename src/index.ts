import packageInfo from "./package-info";
import type { IExternalPackage } from "@jspatcher/jspatcher/src/core/GlobalPackageManager";

export const name = packageInfo.name.split("/").pop().replace(/^package-/, '');

export const { author, license, keywords, version, description, jspatcher } = packageInfo;

export default { name, author, license, keywords, version, description, ...jspatcher } as IExternalPackage;
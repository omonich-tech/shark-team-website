import {
  getBranchPublicData,
  tryGetBranchPublicData,
  type BranchPublicData
} from "@/server/public-data/branch";

export function getSchool117PublicData() {
  return getBranchPublicData("school-117");
}

export type School117PublicData = BranchPublicData;

export function tryGetSchool117PublicData() {
  return tryGetBranchPublicData("school-117");
}

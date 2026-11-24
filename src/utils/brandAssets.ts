import loginShowcaseImg from '../assets/images/login_global_exchange_1793684765710.jpg';
import studyHubHeroImg from '../assets/images/hero_landmarks_banner_1795320717233.jpg';
import verifiedBannerImg from '../assets/images/verified_connect_banner_inline.jpg?inline';
import gameTitleBgImg from '../assets/images/game_lexicon_title_bg_1795276394431.jpg';

import roomLondonImg from '../assets/images/room_london_uk_1795320718013.jpg';
import roomBerlinImg from '../assets/images/room_berlin_de_1795320718104.jpg';
import roomMadridImg from '../assets/images/room_madrid_es_1795320718441.jpg';
import roomParisImg from '../assets/images/room_paris_fr_1795320718425.jpg';
import roomRomeImg from '../assets/images/room_rome_it_1795320717662.jpg';
import roomKyotoImg from '../assets/images/room_kyoto_ja_1795320717479.jpg';
import roomShanghaiImg from '../assets/images/room_shanghai_zh_1795320717808.jpg';
import roomLisbonImg from '../assets/images/room_lisbon_pt_1795320718575.jpg';

import avatarHannahImg from '../assets/images/avatar_hannah_lindner_1794935276832.jpg';
import avatarMaxImg from '../assets/images/avatar_maximilian_krause_1794935277052.jpg';
import avatarSarahImg from '../assets/images/avatar_sarah_jenkins_1794935277812.jpg';
import avatarElenaImg from '../assets/images/avatar_elena_morales_1794935278463.jpg';
import avatarAlexImg from '../assets/images/avatar_alex_rivera_1794935278060.jpg';

export const BRAND_IMAGES = {
  logo: '/assets/aistudio/image_33110acb.png',
  loginShowcase: loginShowcaseImg,
  studyHubHero: studyHubHeroImg,
  verifiedBanner: verifiedBannerImg,
  gameTitleBg: gameTitleBgImg,
  roomPhotos: {
    en: roomLondonImg,
    de: roomBerlinImg,
    es: roomMadridImg,
    fr: roomParisImg,
    it: roomRomeImg,
    ja: roomKyotoImg,
    zh: roomShanghaiImg,
    pt: roomLisbonImg
  } as Record<string, string>,
  avatars: {
    hannah: avatarHannahImg,
    maximilian: avatarMaxImg,
    sarah: avatarSarahImg,
    elena: avatarElenaImg,
    alex: avatarAlexImg
  }
} as const;

const NAMED_AVATAR_MAP: Record<string, string> = {
  'hannah lindner': avatarHannahImg,
  'dr. hannah lindner': avatarHannahImg,
  'claire bennett': avatarSarahImg,
  'sarah jenkins': avatarSarahImg,
  'camille moreau': avatarElenaImg,
  'camille dupont': avatarElenaImg,
  'maximilian krause': avatarMaxImg,
  'lorenzo conti': avatarAlexImg,
  'rafael nogueira': avatarMaxImg,
  'elena morales': avatarElenaImg,
  'elena rostova': avatarHannahImg,
  'sofia martinez': avatarElenaImg,
  'alex rivera': avatarAlexImg,
  'alex mercer': avatarAlexImg,
  'marco rossi': avatarMaxImg
};

/**
 * Resolves a bundled local portrait image when available for known hosts, teachers,
 * partners, or learners; otherwise returns the caller-supplied URL or fallback.
 */
export function resolvePortraitAsset(name?: string | null, rawUrl?: string | null): string | undefined {
  const cleanName = (name || '').trim().toLowerCase();
  if (cleanName && NAMED_AVATAR_MAP[cleanName]) {
    return NAMED_AVATAR_MAP[cleanName];
  }
  if (rawUrl && !rawUrl.includes('images.unsplash.com')) {
    return rawUrl;
  }
  return undefined;
}

import { CATEGORIES, LANGUAGE_OPTIONS } from '../../data/seed';

export const CATS = {
  all: 'Tất cả địa điểm',
  ...Object.fromEntries(CATEGORIES.map(({ value, label }) => [value, label])),
};

export const LANG = Object.fromEntries(
  LANGUAGE_OPTIONS.map(({ value, short, label }) => [
    value,
    { short, label },
  ]),
);

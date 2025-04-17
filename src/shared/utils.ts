/**
 * Underground Fight Club - Shared Utilities
 * Common utility functions used throughout the project
 */

import { Vector3, Vector4 } from './types';

/**
 * Generates a random UUID v4
 */
export function generateUUID(): string {
  const hex = '0123456789abcdef';
  let uuid = '';
  
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8];
    } else {
      uuid += hex[(Math.random() * 16) | 0];
    }
  }
  
  return uuid;
}

/**
 * Calculates distance between two 3D points
 */
export function getDistance(point1: Vector3, point2: Vector3): number {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  const dz = point1.z - point2.z;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Formats a number as currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Formats a duration in seconds to a readable string
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Calculates new Elo ratings for two players based on outcome
 * @param ratingA Rating of player A
 * @param ratingB Rating of player B
 * @param outcome 1 if A won, 0 if B won, 0.5 for draw
 * @param kFactor How quickly ratings change
 * @returns [newRatingA, newRatingB]
 */
export function calculateEloRating(
  ratingA: number,
  ratingB: number,
  outcome: number,
  kFactor: number = 32
): [number, number] {
  // Calculate expected outcome
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));
  
  // Calculate new ratings
  const newRatingA = Math.round(ratingA + kFactor * (outcome - expectedA));
  const newRatingB = Math.round(ratingB + kFactor * ((1 - outcome) - expectedB));
  
  return [newRatingA, newRatingB];
}

/**
 * Gets a random item from an array
 */
export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Checks if a value is between min and max (inclusive)
 */
export function isBetween(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Safe JSON parse with default value
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Calculates if a random chance occurs
 * @param chance Number between 0 and 1
 */
export function randomChance(chance: number): boolean {
  return Math.random() < chance;
}

/**
 * Formats a timestamp to a readable date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Checks if a point is within a radius of another point
 */
export function isPointInRadius(point: Vector3, center: Vector3, radius: number): boolean {
  return getDistance(point, center) <= radius;
}

/**
 * Gets the angle between two 2D points in degrees
 */
export function getAngleBetweenPoints(point1: { x: number, y: number }, point2: { x: number, y: number }): number {
  return Math.atan2(point2.y - point1.y, point2.x - point1.x) * 180 / Math.PI;
}

/**
 * Returns a position in front of a location based on heading
 */
export function getPositionInFront(position: Vector4, distance: number): Vector3 {
  const headingRad = (position.h * Math.PI) / 180;
  
  return {
    x: position.x + Math.sin(-headingRad) * distance,
    y: position.y + Math.cos(-headingRad) * distance,
    z: position.z
  };
}

/**
 * Capitalizes the first letter of each word in a string
 */
export function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
} 
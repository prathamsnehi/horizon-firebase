import { TransportationOption, TransportationMode } from "../types";

/**
 * Calculates the straight-line (Haversine) distance between two coordinates in miles.
 */
export function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);

    const R = 3958.8; // Earth radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Return rounded to 1 decimal place
    return Math.round((R * c) * 10) / 10;
}

/**
 * Calculates the heuristic travel time for all transportation modes the user has selected.
 * 
 * @param miles - The distance in miles
 * @param userModes - The array of transportation modes the user selected (e.g., ["walking", "car"])
 * @returns An array of TransportationOption with `isRecommended` defaulted to false (AI will set to true later)
 */
export function calculateAllTransportOptions(miles: number, userModes: TransportationMode[]): TransportationOption[] {
    const WALK_MULTIPLIER = 20;
    const BIKE_MULTIPLIER = 5;
    const TRANSIT_MULTIPLIER = 4;
    const CAR_MULTIPLIER = 1.5;

    const TRANSIT_PENALTY = 10;
    const CAR_PENALTY = 5;

    const options: TransportationOption[] = [];

    // Default to car if they didn't select anything
    const modesToProcess: TransportationMode[] = userModes.length > 0 ? userModes : ["car"];

    for (const mode of modesToProcess) {
        let multiplier = CAR_MULTIPLIER; 
        let basePenalty = 0;
        
        if (mode === "walking") {
            multiplier = WALK_MULTIPLIER;
        } else if (mode === "bike") {
            multiplier = BIKE_MULTIPLIER;
        } else if (mode === "publicTransport") {
            multiplier = TRANSIT_MULTIPLIER;
            basePenalty = TRANSIT_PENALTY;
        } else if (mode === "car") {
            multiplier = CAR_MULTIPLIER;
            basePenalty = CAR_PENALTY;
        } else if (mode === "rideshare") {
            multiplier = CAR_MULTIPLIER;
            basePenalty = CAR_PENALTY;
        }

        let totalMins = Math.round((miles * multiplier) + basePenalty);
        
        // Ensure at least 1 minute
        if (totalMins < 1) totalMins = 1;

        options.push({
            mode: mode,
            estimatedTravelMinutes: totalMins,
            isRecommended: false
        });
    }

    return options;
}

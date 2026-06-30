import { calculateDistanceMiles, calculateAllTransportOptions } from "../../utils/distance";
import { TransportationMode } from "../../types";

describe("distance utils", () => {
    describe("calculateDistanceMiles", () => {
        it("should calculate correct miles between two points", () => {
            // New York City to Philadelphia (approx 80-90 miles)
            const nyLat = 40.7128;
            const nyLon = -74.0060;
            const phillyLat = 39.9526;
            const phillyLon = -75.1652;

            const distance = calculateDistanceMiles(nyLat, nyLon, phillyLat, phillyLon);
            expect(distance).toBeGreaterThan(75);
            expect(distance).toBeLessThan(100);
        });

        it("should return 0 for identical coordinates", () => {
            const distance = calculateDistanceMiles(40.0, -75.0, 40.0, -75.0);
            expect(distance).toBe(0);
        });
    });

    describe("calculateAllTransportOptions", () => {
        it("should return options for all provided user modes with default isRecommended false", () => {
            const userModes: TransportationMode[] = ["walking", "car", "bike"];
            const miles = 2; // 2 miles

            const options = calculateAllTransportOptions(miles, userModes);
            
            expect(options).toHaveLength(3);
            expect(options.map(o => o.mode)).toEqual(["walking", "car", "bike"]);
            
            options.forEach(opt => {
                expect(opt.isRecommended).toBe(false);
            });
        });

        it("should calculate correct estimated travel minutes based on multipliers and penalties", () => {
            // Walk multiplier = 20
            // Bike multiplier = 5
            // Transit multiplier = 4, penalty = 10
            // Car multiplier = 1.5, penalty = 5
            const userModes: TransportationMode[] = ["walking", "bike", "publicTransport", "car"];
            const miles = 5;

            const options = calculateAllTransportOptions(miles, userModes);

            const walkOpt = options.find(o => o.mode === "walking");
            const bikeOpt = options.find(o => o.mode === "bike");
            const transitOpt = options.find(o => o.mode === "publicTransport");
            const carOpt = options.find(o => o.mode === "car");

            expect(walkOpt?.estimatedTravelMinutes).toBe(Math.round(5 * 20)); // 100
            expect(bikeOpt?.estimatedTravelMinutes).toBe(Math.round(5 * 5)); // 25
            expect(transitOpt?.estimatedTravelMinutes).toBe(Math.round(5 * 4 + 10)); // 30
            expect(carOpt?.estimatedTravelMinutes).toBe(Math.round(5 * 1.5 + 5)); // 13
        });

        it("should default to car if userModes is empty", () => {
            const options = calculateAllTransportOptions(10, []);
            expect(options).toHaveLength(1);
            expect(options[0].mode).toBe("car");
        });

        it("should ensure a minimum of 1 minute of travel time", () => {
            const options = calculateAllTransportOptions(0.001, ["walking"]);
            expect(options[0].estimatedTravelMinutes).toBe(1);
        });
    });
});

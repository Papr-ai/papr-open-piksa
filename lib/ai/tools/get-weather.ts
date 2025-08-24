import { tool, type Tool, type ToolCallOptions } from 'ai';
import { z } from 'zod';

const weatherSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

type WeatherInput = z.infer<typeof weatherSchema>;
type WeatherOutput = {
  current: {
    temperature_2m: number;
  };
  hourly: {
    temperature_2m: number[];
  };
  daily: {
    sunrise: string[];
    sunset: string[];
  };
};

export const getWeather: Tool<WeatherInput, WeatherOutput> = tool({
  description: 'Get the current weather at a location',
  inputSchema: weatherSchema,
  execute: async (input: WeatherInput, options: ToolCallOptions): Promise<WeatherOutput> => {
    const { latitude, longitude } = input;
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
    );

    const weatherData = await response.json();
    return weatherData as WeatherOutput;
  },
});

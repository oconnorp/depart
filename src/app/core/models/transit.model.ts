export interface BartTrain {
  dest: string;
  minsFromNow: number;
  departsAt: Date;
}

export interface MuniBus {
  line: string;
  departsAt: Date;
  minsFromNow: number;
}

export interface TransitChainOption {
  bus: MuniBus;
  leaveHome: Date;
  arriveAt24th: Date;
  bartDeparture: Date;
  matchedTrain: BartTrain | null;
  actualArrivalRockridge: Date;
  onTime: boolean;
}

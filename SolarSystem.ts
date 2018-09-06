import {Kilo, Metre, Second} from './units';
import {Vec3} from './types';

export const SolarSystemData = [
  {
    name: "Sol",
    gravitational_parameter: 1.3271244004193938e+11 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 696000.0 * Kilo * Metre,
  },
  {
    name: "Earth",
    gravitational_parameter: 3.9860043543609598e+05 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 6371.0084 * Kilo * Metre,
  },
  {
    name: "Luna",
    gravitational_parameter: 4.9028000661637961e+03 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 1737.4 * Kilo * Metre,
  },
  {
    name: "Mercury",
    gravitational_parameter: 2.2031780000000021e+04 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 2439.7 * Kilo * Metre,
  },
  {
    name: "Venus",
    gravitational_parameter: 3.2485859200000006e+05 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 6051.8 * Kilo * Metre,
  },
  {
    name: "Mars",
    gravitational_parameter: 4.282837362069909e+04 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 3389.5 * Kilo * Metre,
  },
]

export const SolarSystemJD2451545 = [
  {
    body: "Sol",
    position: new Vec3(
      -1.067598502264559e+06 * Kilo * Metre,
      -3.959890535950128e+05 * Kilo * Metre,
      -1.380711260212289e+05 * Kilo * Metre,
    ),
    velocity: new Vec3(
      +9.312570119052345e-03 * Kilo * Metre / Second,
      -1.170150735349599e-02 * Kilo * Metre / Second,
      -5.251247980405208e-03 * Kilo * Metre / Second,
    ),
  },
  {
    body: "Earth",
    position: new Vec3(
      -2.756663225908748e+07 * Kilo * Metre,
      +1.323614283011928e+08 * Kilo * Metre,
      +5.741864727316781e+07 * Kilo * Metre,
    ),
    velocity: new Vec3(
      -2.978494749707266e+01 * Kilo * Metre / Second,
      -5.029753833589443e+00 * Kilo * Metre / Second,
      -2.180645051457051e+00 * Kilo * Metre / Second,
    ),
  },
  {
    body: "Luna",
    position: new Vec3(
      -2.785824064408012e+07 * Kilo * Metre,
      +1.320947114679507e+08 * Kilo * Metre,
      +5.734254478723364e+07 * Kilo * Metre,
    ),
    velocity: new Vec3(
      -2.914141611066932e+01 * Kilo * Metre / Second,
      -5.695841519211172e+00 * Kilo * Metre / Second,
      -2.481970755642522e+00 * Kilo * Metre / Second,
    ),
  },
  {
    body: "Mercury",
    position: new Vec3(
      -2.052932489502387e+07 * Kilo * Metre,
      -6.032395676436062e+07 * Kilo * Metre,
      -3.013084385588142e+07 * Kilo * Metre,
    ),
    velocity: new Vec3(
      +3.700430445042139e+01 * Kilo * Metre / Second,
      -8.541376874560308e+00 * Kilo * Metre / Second,
      -8.398372276762027e+00 * Kilo * Metre / Second,
    ),
  },
  {
    body: "Venus",
    position: new Vec3(
      -1.085240925511762e+08 * Kilo * Metre,
      -7.318517883756028e+06 * Kilo * Metre,
      +3.548115911200081e+06 * Kilo * Metre,
    ),
    velocity: new Vec3(
      +1.391218618039207e+00 * Kilo * Metre / Second,
      -3.202951994557884e+01 * Kilo * Metre / Second,
      -1.449708670519373e+01 * Kilo * Metre / Second,
    ),
  },
  {
    body: "Mars",
    position: new Vec3(
      +2.069805421180782e+08 * Kilo * Metre,
      -1.863697276138850e+05 * Kilo * Metre,
      -5.667233334924674e+06 * Kilo * Metre,
    ),
    velocity: new Vec3(
      +1.171984953383225e+00 * Kilo * Metre / Second,
      +2.390670820059185e+01 * Kilo * Metre / Second,
      +1.093392065180724e+01 * Kilo * Metre / Second,
    ),
  },
]
